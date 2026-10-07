// Types mirroring the backend contract exactly (app/schemas.py +
// agent/analysis.py). Every string field may be "Unknown"; clock fields may be
// absent when the parser could not extract them.

export type OperationState =
  | 'idle'
  | 'connecting'
  | 'retrieving_context'
  | 'generating'
  | 'validating'
  | 'compiling'
  | 'flashing'
  | 'success'
  | 'error';

// ---------------------------------------------------------------- hardware
// agent/analysis.py: one entry per HAL_GPIO_Init call.
export interface HardwareGPIO {
  port: string; // e.g. "GPIOD"
  pins: string; // e.g. "GPIO_PIN_12" (raw expression, may be "Unknown")
  pin_names: string[]; // e.g. ["D12", "D13"] — port letter + pin number
  mode: string; // e.g. "GPIO_MODE_OUTPUT_PP"
  pull: string; // e.g. "GPIO_NOPULL"
  speed: string; // e.g. "GPIO_SPEED_FREQ_LOW"
}

export interface HardwareClock {
  source?: string; // RCC_OscInitStruct.OscillatorType
  PLLM?: string;
  PLLN?: string;
  PLLP?: string; // e.g. "RCC_PLLP_DIV2"
  PLLQ?: string;
  AHBPrescaler?: string;
  APB1Prescaler?: string;
  APB2Prescaler?: string;
  sysclk_mhz?: number | 'Unknown';
  pll_vco_mhz?: number;
  hclk_mhz?: number;
  pclk1_mhz?: number;
  pclk2_mhz?: number;
  usb_mhz?: number;
  warnings?: string[];
}

// Flat parameter map, e.g. { USART1: { BaudRate: "115200" } }.
// A peripheral present in this map is one the generated code initializes.
export interface HardwarePeripherals {
  [name: string]: Record<string, string>;
}

export interface HardwareState {
  gpio: HardwareGPIO[];
  clock: HardwareClock;
  peripherals: HardwarePeripherals;
}

/** "PD12" -> "D12": maps a board pin to the parser's pin_names format. */
export function pinNameFor(pin: string): string {
  return pin.replace(/^P/, '');
}

// ---------------------------------------------------------------- requests / responses
export interface GenerateRequest {
  prompt: string;
  verify?: boolean;
}

export interface BuildCheck {
  status: 'success' | 'error';
  logs: string;
}

export interface GenerateResponse {
  id: string;
  code: string;
  hardware_state: HardwareState;
  build?: BuildCheck | null;
}

export interface VerifyRequest {
  id: string;
}

export interface FlashRequest {
  id: string;
  confirmed: boolean;
  port?: string;
}

// Soft-fail: flash failures come back as HTTP 200 with status "error".
export interface FlashResponse {
  status: 'success' | 'error';
  logs: string;
}

export interface GenerateAndFlashRequest {
  command: string;
  auto_confirm?: boolean;
}

export interface GenerateAndFlashResponse {
  status: string;
  message: string;
}

export interface HealthResponse {
  status: string;
  components?: {
    vector_store_documents?: number;
    ollama?: { reachable?: boolean; models?: string[] };
    st_link_port?: string | null;
    chat_log?: 'enabled' | 'disabled';
  } | null;
}

export interface PortInfo {
  device: string | null;
  description: string;
  hwid: string;
  st_link: boolean;
}

// ---------------------------------------------------------------- chat
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  /** Resume this stored chat-log session; stored history wins over `history`. */
  session_id?: string;
}

export interface ChatResponse {
  answer: string;
  sources: string[];
  /** Session this turn was stored under; null when chat persistence is off. */
  session_id: string | null;
}

/** A message as stored in the chat log (assistant turns keep their sources). */
export interface StoredChatMessage extends ChatMessage {
  sources?: string[];
  ts?: string;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionDetail extends ChatSessionSummary {
  messages: StoredChatMessage[];
}

// ---------------------------------------------------------------- jobs
export type JobStatus =
  | 'generated'
  | 'verified'
  | 'compile_failed'
  | 'flashing'
  | 'flashed'
  | 'failed';

export interface JobSummary {
  id: string;
  command: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  error: string | null;
}

export interface JobDetail extends JobSummary {
  code: string;
  hardware_state: HardwareState;
  context: string;
  logs: string | null;
}

// ---------------------------------------------------------------- UI helpers
export interface FirmwareOperationStatus {
  state: OperationState;
  message: string;
  progress?: number;
  logs: string[];
  generatedCode?: string;
  hardwareState?: HardwareState;
  error?: string;
  jobId?: string;
}

export interface BoardConfig {
  board: string;
  mcu: string;
  leds: {
    blue: string;
    green: string;
    orange: string;
    red: string;
  };
  userButton: string;
}

export const BOARD_CONFIG: BoardConfig = {
  board: 'STM32F4-Discovery',
  mcu: 'STM32F407VGT6',
  leds: {
    blue: 'PD15',
    green: 'PD12',
    orange: 'PD13',
    red: 'PD14',
  },
  userButton: 'PA0',
};

export const EXAMPLE_COMMANDS: string[] = [
  'Make the blue LED blink when I press the user button.',
  'Make the green and red LEDs alternate every 500 milliseconds.',
  'Use DMA to blink the green and blue LEDs after the button is held for two seconds.',
  'Use an interrupt on the user button to blink the red and blue LEDs.',
  'Turn on the blue LED continuously.',
];

export const LED_COLORS: Record<string, string> = {
  PD12: '#00ff00', // Green
  PD13: '#ff8800', // Orange
  PD14: '#ff0000', // Red
  PD15: '#0088ff', // Blue
};

export const OPERATION_STATE_LABELS: Record<OperationState, string> = {
  idle: 'Ready',
  connecting: 'Connecting to backend...',
  retrieving_context: 'Retrieving context...',
  generating: 'Generating firmware...',
  validating: 'Validating code...',
  compiling: 'Compiling firmware...',
  flashing: 'Flashing board...',
  success: 'Operation completed successfully',
  error: 'Operation failed',
};

export const OPERATION_STATE_COLORS: Record<OperationState, string> = {
  idle: '#6b7280',
  connecting: '#3b82f6',
  retrieving_context: '#3b82f6',
  generating: '#8b5cf6',
  validating: '#f59e0b',
  compiling: '#f97316',
  flashing: '#ec4899',
  success: '#10b981',
  error: '#ef4444',
};
