import type { Vec3 } from '../core/types.ts';

export interface ViewState { p: Vec3; t: Vec3 }
export interface SceneApi { getView(): ViewState }
/** Richiesta di spostare la camera (verso un nodo oppure alla visuale iniziale). */
export interface FocusRequest { seq: number; kind: 'node' | 'home'; idx: number; instant?: boolean; flash?: boolean }
export interface HoverInfo { idx: number; x: number; y: number }
