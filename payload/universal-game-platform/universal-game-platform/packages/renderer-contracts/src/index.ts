/**
 * @ugp/renderer-contracts
 * Shader/buffer/texture/pipeline creation, frame submission, backend negotiation (WebGPU/WebGL2/Vulkan/DX/Metal/OpenGL/OpenXR)
 */
export interface RendererServices {
  // Contract interface — implemented by platform runtime
  version: string;
  initialize(config: unknown): Promise<void>;
  dispose(): Promise<void>;
}

export const CONTRACT_VERSION = "1.0.0";
