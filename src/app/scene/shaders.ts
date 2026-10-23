/**
 * Shader della rete. Tutto il movimento organico e la luminosità vengono calcolati sulla GPU a partire da
 *  - coordinate STABILI (attributi, calcolate in build)
 *  - una piccola texture di stato per nodo (riga 0: luminosità, attenuazione, evidenziazione; riga 1: seme + colore).
 * Cambiare attività, selezione o hover = aggiornare poche decine di float, mai la geometria.
 */
const COMMON = /* glsl */ `
uniform sampler2D uState;
uniform float uCount;
uniform float uTime;
uniform float uAmp;
uniform float uIntro;
uniform float uFogNear;
uniform float uFogFar;
vec4 dynState(float idx) { return texture2D(uState, vec2((idx + 0.5) / uCount, 0.25)); } // x: luminosità, y: attenuazione, z: evidenza
vec4 staState(float idx) { return texture2D(uState, vec2((idx + 0.5) / uCount, 0.75)); } // x: seme, yzw: colore
// Oscillazione lentissima attorno alla posizione stabile (somma di sinusoidi incommensurabili, nessuna simulazione fisica)
vec3 wobble(float seed) {
  float a = seed * 6.2831853;
  float t = uTime;
  return uAmp * vec3(
    sin(t * 0.110 + a)       + 0.5 * sin(t * 0.071 + a * 2.3),
    sin(t * 0.093 + a * 1.7) + 0.5 * sin(t * 0.127 + a * 0.6),
    sin(t * 0.083 + a * 2.9) + 0.5 * sin(t * 0.053 + a * 1.3));
}
float fogFactor(float dist) { return mix(0.3, 1.0, 1.0 - smoothstep(uFogNear, uFogFar, dist)); }
`;

const CURVE = /* glsl */ `
uniform float uSway;
// Bézier cubica con estremi che seguono l'oscillazione dei nodi + leggero ondeggiamento ortogonale
vec3 curvePos(float t, vec3 a, vec3 b, vec3 n1, vec3 n2, float seedA, float seedB, float edgeSeed) {
  vec3 oa = wobble(seedA), ob = wobble(seedB);
  vec3 p0 = a + oa, p3 = b + ob;
  vec3 p1 = a + (b - a) / 3.0 + n1 + mix(oa, ob, 0.3);
  vec3 p2 = a + (b - a) * 2.0 / 3.0 + n2 + mix(oa, ob, 0.7);
  float u = 1.0 - t;
  vec3 p = u * u * u * p0 + 3.0 * u * u * t * p1 + 3.0 * u * t * t * p2 + t * t * t * p3;
  vec3 axis = normalize(n1 + vec3(1.0e-4));
  return p + axis * sin(uTime * 0.23 + edgeSeed * 6.2831853 + t * 4.0) * uSway * sin(t * 3.14159265);
}
`;

export const WIRE_VERT = /* glsl */ `${COMMON}
uniform float uSpin; uniform float uLineMin; uniform float uLineMax; uniform float uDetailNear; uniform float uDetailFar;
attribute vec3 aLocal; attribute vec3 aCenter; attribute vec2 aNode;
varying vec3 vColor; varying float vAlpha;
void main() {
  vec4 d = dynState(aNode.x); vec4 s = staState(aNode.x);
  float ang = s.x * 6.2831853 + uTime * uSpin * (0.4 + s.x);
  float cs = cos(ang), sn = sin(ang);
  vec3 l = vec3(cs * aLocal.x + sn * aLocal.z, aLocal.y, -sn * aLocal.x + cs * aLocal.z);
  vec4 mv = modelViewMatrix * vec4(aCenter + wobble(s.x) + l, 1.0);
  float dist = -mv.z;
  // LOD: i dettagli interni (aNode.y = 1) svaniscono con la distanza
  float detail = mix(1.0, 1.0 - smoothstep(uDetailNear, uDetailFar, dist), aNode.y);
  float b = d.x;
  vAlpha = (uLineMin + (uLineMax - uLineMin) * b) * d.y * detail * fogFactor(dist) * uIntro + d.z * 0.5 * detail;
  vColor = s.yzw * (0.75 + 0.45 * b + d.z * 0.5);
  gl_Position = projectionMatrix * mv;
}`;

export const WIRE_FRAG = /* glsl */ `
varying vec3 vColor; varying float vAlpha;
void main() { gl_FragColor = vec4(vColor, vAlpha); }`;

export const POINT_VERT = /* glsl */ `${COMMON}
uniform float uPointScale; uniform float uCore; uniform float uHalo;
attribute vec3 aCenter; attribute vec3 aInfo;
varying vec3 vColor; varying float vAlpha; varying float vKind;
void main() {
  vec4 d = dynState(aInfo.x); vec4 s = staState(aInfo.x);
  vec4 mv = modelViewMatrix * vec4(aCenter + wobble(s.x), 1.0);
  float dist = max(0.1, -mv.z);
  float b = d.x;
  float halo = step(0.5, aInfo.y);
  float shimmer = 0.92 + 0.08 * sin(uTime * 0.6 + s.x * 6.2831853);
  float size = aInfo.z * mix(1.0, 0.8 + 0.6 * b, halo);
  gl_PointSize = clamp(size * uPointScale / dist, mix(1.5, 0.0, halo), 240.0);
  float fog = fogFactor(dist);
  float haloA = uHalo * (0.12 + 0.88 * b * b) * d.y * fog * uIntro + d.z * 0.12;
  float coreA = uCore * (0.4 + 0.6 * b) * shimmer * mix(0.35, 1.0, d.y) * fog * uIntro + d.z * 0.6;
  vAlpha = mix(coreA, haloA, halo);
  vColor = mix(mix(s.yzw, vec3(1.0), 0.3 * b), s.yzw, halo);
  vKind = halo;
  gl_Position = projectionMatrix * mv;
}`;

export const POINT_FRAG = /* glsl */ `
varying vec3 vColor; varying float vAlpha; varying float vKind;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float f = vKind > 0.5 ? pow(1.0 - r, 2.2) : smoothstep(1.0, 0.25, r);
  gl_FragColor = vec4(vColor, vAlpha * f);
}`;

export const FIL_VERT = /* glsl */ `${COMMON}${CURVE}
uniform float uFilMin; uniform float uFilMax;
attribute float aT; attribute vec3 aA; attribute vec3 aB; attribute vec3 aN1; attribute vec3 aN2; attribute vec4 aE;
varying vec3 vColor; varying float vAlpha;
void main() {
  vec4 dA = dynState(aE.x), dB = dynState(aE.y), sA = staState(aE.x), sB = staState(aE.y);
  vec3 p = curvePos(aT, aA, aB, aN1, aN2, sA.x, sB.x, aE.w);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float act = sqrt(dA.x * dB.x);                       // le connessioni tra argomenti attivi sono più luminose
  vAlpha = (uFilMin + (uFilMax - uFilMin) * act) * (0.4 + 0.6 * aE.z) * min(dA.y, dB.y) * fogFactor(-mv.z) * uIntro
         + max(dA.z, dB.z) * 0.15;
  vColor = mix(sA.yzw, sB.yzw, aT) * (0.8 + 0.4 * act);
  gl_Position = projectionMatrix * mv;
}`;

export const FIL_FRAG = WIRE_FRAG;

export const PULSE_VERT = /* glsl */ `${COMMON}${CURVE}
uniform float uPulseMin; uniform float uPulseMax; uniform float uPulseSize; uniform float uMinB; uniform float uPointScale;
attribute vec3 aA; attribute vec3 aB; attribute vec3 aN1; attribute vec3 aN2; attribute vec4 aE; attribute vec3 aP;
varying vec3 vColor; varying float vAlpha;
float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
void main() {
  vec4 dA = dynState(aE.x), dB = dynState(aE.y), sA = staState(aE.x), sB = staState(aE.y);
  float cyc = uTime * aP.y + aP.x;
  float k = floor(cyc);
  float f = fract(cyc);
  float t = aP.z > 0.5 ? 1.0 - f : f;
  float act = clamp((sqrt(dA.x * dB.x) - uMinB) / (1.0 - uMinB), 0.0, 1.0);
  // frequenza degli impulsi = attività dei nodi collegati: ogni ciclo emette solo con una certa probabilità
  float rate = mix(uPulseMin, uPulseMax, act * act);
  float gate = step(h11(k * 3.17 + aE.w * 91.7 + aP.x * 13.0), rate);
  vec3 p = curvePos(t, aA, aB, aN1, aN2, sA.x, sB.x, aE.w);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = max(0.1, -mv.z);
  vAlpha = gate * sin(f * 3.14159265) * min(dA.y, dB.y) * fogFactor(dist) * uIntro * (0.4 + 0.6 * act);
  vColor = mix(sA.yzw, sB.yzw, t) * 0.7 + 0.45;
  gl_PointSize = clamp(uPulseSize * uPointScale / dist, 1.0, 40.0);
  gl_Position = projectionMatrix * mv;
}`;

export const PULSE_FRAG = /* glsl */ `
varying vec3 vColor; varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0 || vAlpha < 0.003) discard;
  gl_FragColor = vec4(vColor, vAlpha * pow(1.0 - r, 1.6));
}`;
