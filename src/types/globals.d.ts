/**
 * Global type declarations for the Pixels Roll20 Chrome Extension.
 *
 * These augment the Window interface with extension-specific properties that
 * modules attach at runtime for backward compatibility with the content-script
 * loading model (manifest.json injects scripts sequentially into a shared scope).
 */

// --- Pixel Die Object ---

interface PixelDie {
  readonly name: string;
  readonly deviceId: string;
  readonly isConnected: boolean;
  readonly device: BluetoothDevice | null;
  readonly server: BluetoothRemoteGATTServer | null;
  readonly lastActivity: number;
  readonly lastFaceUp: number | null;
  readonly dieType: number | null;
  readonly batteryLevel: number | null;
  setNotifyCharacteristic(notify: BluetoothRemoteGATTCharacteristic): void;
  startConnectionMonitoring(): void;
  markDisconnected(): void;
  reconnect(
    server: BluetoothRemoteGATTServer,
    notify: BluetoothRemoteGATTCharacteristic | null,
    device?: BluetoothDevice
  ): void;
  disconnect(): void;
  destroy(): void;
  handleNotifications(event: Event): void;
  updateActivity(): void;
  blink(color?: number, count?: number, duration?: number): Promise<void>;
  // Internal compatibility properties
  readonly _name: string;
  readonly _deviceId: string;
  readonly _isConnected: boolean;
  readonly _device: BluetoothDevice | null;
  readonly _server: BluetoothRemoteGATTServer | null;
  readonly _lastActivity: number;
  _reconnectAttempts: number;
  _hasDisconnectListener: boolean;
}

// --- Modifier Box Interfaces ---

interface ModifierBoxModule {
  create(): Promise<HTMLElement | null>;
  show(): Promise<void>;
  hide(): void;
  isVisible(): boolean;
  getElement(): HTMLElement | null;
  updateSelectedModifier(): void;
  isInitialized(): boolean;
  updateTheme(): void;
  forceThemeRefresh(): void;
  syncGlobalVars(): void;
  clearAll(): void;
  resetState(): void;
}

interface ModifierBoxThemeManagerModule {
  addStyles(): void;
  updateTheme(modifierBox: HTMLElement): void;
  startThemeMonitoring(
    callback: (theme: string, colors: ThemeColors) => void
  ): void;
  stopThemeMonitoring(): void;
  forceThemeRefresh(modifierBox: HTMLElement): void;
  forceElementUpdates(modifierBox: HTMLElement): void;
  resetState(): void;
}

interface ModifierBoxDragHandlerModule {
  setupDragFunctionality(modifierBox: HTMLElement): void;
}

interface ModifierBoxRowManagerModule {
  setupModifierRowLogic(modifierBox: HTMLElement): void;
  addModifierRow(modifierBox: HTMLElement): void;
  removeModifierRow(rowElement: HTMLElement, modifierBox: HTMLElement): void;
  updateEventListeners(modifierBox: HTMLElement): void;
  updateSelectedModifier(): void;
  clearModifierState(): void;
  reindexRows(modifierBox: HTMLElement): void;
  serializeRows(modifierBox: HTMLElement): RowData;
  applyRows(modifierBox: HTMLElement, data: RowData): boolean;
  saveModifierRows(modifierBox: HTMLElement): void;
  loadModifierRows(modifierBox: HTMLElement): boolean;
  applyProfileRows(modifierBox: HTMLElement, profile: RowData): boolean;
  clearStoredModifierRows(): void;
  resetAllRows(modifierBox: HTMLElement): void;
  executeFormula(formula: string): void;
  getRowCounter(): number;
  setRowCounter(value: number): void;
  resetState?(): void;
}

interface ModifierBoxUIControlsModule {
  setupMinimizeControls(modifierBox: HTMLElement): void;
  setupClearAllControls(
    modifierBox: HTMLElement,
    clearAllCallback: () => void
  ): void;
  applyMinimizedState(modifierBox: HTMLElement, minimized: boolean): void;
  restoreMinimizedState(modifierBox: HTMLElement): Promise<void>;
}

interface ModifierBoxStateManagerModule {
  getModifierBoxElement(): HTMLElement | null;
  isModifierBoxVisible(): boolean;
  isModifierBoxInitialized(): boolean;
  isModifierBoxCreated(): boolean;
  setModifierBoxElement(element: HTMLElement | null): HTMLElement | null;
  setModifierBoxVisible(visible: boolean): boolean;
  setModifierBoxCreated(created: boolean): boolean;
  findExistingModifierBox(): HTMLElement | null;
  resetState(): void;
  updateLegacyDefaults(modifierBox: HTMLElement): void;
  ensureModifierBoxInDOM(modifierBox: HTMLElement): boolean;
  validatePosition(modifierBox: HTMLElement): void;
  getStateSummary(): StateSummary;
}

interface ModifierBoxPopoutManagerModule {
  setupPopoutControls(modifierBox: HTMLElement): void;
  isSupported(): boolean;
}

interface ModifierBoxComponentInitializerModule {
  setupModifierBoxComponents(
    modifierBox: HTMLElement,
    clearAllCallback: () => void
  ): boolean;
  checkDependencies(): boolean;
}

interface PixelsCommandModule {
  setupChatInterception(): void;
  offerRoll(dieType: number, faceValue: number): boolean;
  isPromptActive(): boolean;
  cancelPrompt(): void;
  parseFormula(formulaStr: string): object | null;
  interceptFormula(formulaStr: string): boolean;
}

interface RollBatcherModule {
  addRoll(rollData: RollData): void;
  parseDieType(dieName: string, faceValue: number): number;
  flushRolls(): void;
  setWindowMs(ms: number): void;
}

interface PixelsBluetoothModule {
  connectToPixel(): Promise<PixelDie | null>;
  disconnectAllPixels(): void;
  getPixels(): PixelDie[];
  initialize(): object;
  createPixel(
    name: string,
    server: BluetoothRemoteGATTServer,
    device: BluetoothDevice
  ): PixelDie;
  getPixelByDeviceId?(
    deviceId: string,
    pixelList: PixelDie[]
  ): PixelDie | undefined;
}

interface PixelsProfileStorageModule {
  getProfiles(): Promise<ProfileMap>;
  saveProfile(name: string, data: RowData): Promise<boolean>;
  deleteProfile(name: string): Promise<boolean>;
  getMinimized(): Promise<boolean>;
  setMinimized(value: boolean): Promise<boolean>;
  getActiveProfile(): Promise<string | null>;
  setActiveProfile(name: string): Promise<boolean>;
  exportProfiles(): Promise<ProfileExportBundle>;
  exportProfile(name: string): Promise<ProfileExportBundle | null>;
  importProfiles(
    bundle: ProfileExportBundle
  ): Promise<{ imported: number; skipped: number; error?: string }>;
  mergeProfiles(
    localProfiles: ProfileMap,
    syncProfiles: ProfileMap
  ): ProfileMap;
  uniqueName(base: string, existingNames: Set<string>): string;
  PROFILES_KEY: string;
  MINIMIZED_KEY: string;
  ACTIVE_KEY: string;
}

interface ThemeDetectorModule {
  detectTheme(): string;
  parseColor(colorStr: string): RGBColor | null;
  getThemeColors(): ThemeColors;
  onThemeChange(
    callback: (theme: string, colors: ThemeColors) => void
  ): MutationObserver;
}

// --- Data Types ---

interface RowData {
  rows: RowEntry[];
  version?: number;
  selectedIndex?: number;
  rowCounter?: number;
  lastUpdated?: number;
}

interface RowEntry {
  name: string;
  formula: string;
  value?: string;
  originalIndex?: number;
}

interface RollData {
  dieName: string;
  dieType: number;
  faceValue: number;
}

interface ThemeColors {
  theme: string;
  primary: string;
  background: string;
  surface?: string;
  border: string;
  text: string;
  textSecondary?: string;
  input: string;
  inputBorder: string;
  button: string;
  buttonHover?: string;
}

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

interface ProfileMap {
  [name: string]: ProfileEntry;
}

interface ProfileEntry {
  rows: RowEntry[];
  selectedIndex: number;
  savedAt: number;
}

interface ProfileExportBundle {
  type: string;
  version: number;
  exportedAt: number;
  profiles: ProfileMap;
}

interface StateSummary {
  hasElement: boolean;
  isVisible: boolean;
  isCreated: boolean;
  isInitialized: boolean;
  elementId: string | null;
  elementInDOM: boolean;
}

// --- Drag & Drop ---

interface RowDragDropInstance {
  updatePlaceholderTheme(): void;
  cleanup(): void;
}

type RowDragDropFactory = (
  containerSelector: string,
  rowSelector: string,
  rowManagerInstance: ModifierBoxRowManagerModule
) => RowDragDropInstance;

// --- Window Augmentation ---

interface Window {
  // Extension modules
  ModifierBox: ModifierBoxModule;
  ModifierBoxThemeManager: ModifierBoxThemeManagerModule;
  ModifierBoxDragHandler: ModifierBoxDragHandlerModule;
  ModifierBoxRowManager: ModifierBoxRowManagerModule;
  ModifierBoxUIControls: ModifierBoxUIControlsModule;
  ModifierBoxStateManager: ModifierBoxStateManagerModule;
  ModifierBoxPopoutManager: ModifierBoxPopoutManagerModule;
  ModifierBoxComponentInitializer: ModifierBoxComponentInitializerModule;
  ModifierBoxHTMLGenerator: {
    generateModifierBoxHTML(logoUrl?: string): string;
    getLogoUrl(): string;
    createModifierBoxElement(): HTMLElement;
    processTemplateHTML(htmlTemplate: string, logoUrl?: string | null): string;
    extractModifierBoxFromTemplate(processedHTML: string): Element | null;
  };
  PixelsCommand: PixelsCommandModule;
  RollBatcher: RollBatcherModule;
  PixelsBluetooth: PixelsBluetoothModule;
  PixelsProfileStorage: PixelsProfileStorageModule;
  PixelsSessionStorage: {
    saveModifierSettings(): void;
    loadModifierSettings(): boolean;
    updateModifierSettings(): void;
    clearAllModifierSettings(): void;
  };
  ThemeDetector: ThemeDetectorModule;
  CSSLoader: {
    loadCSS(cssPath: string, id: string): Promise<void>;
    loadMultipleCSS(
      cssFiles: Array<{ path: string; id: string }>
    ): Promise<void[]>;
    removeCSS(id: string): void;
    isLoaded(id: string): boolean;
  };
  HTMLLoader: {
    loadTemplate(templatePath: string, id: string): Promise<string>;
    loadMultipleTemplates(
      templates: Array<{ path: string; id: string }>
    ): Promise<string[]>;
    isLoaded(id: string): boolean;
    getTemplate(id: string): string | null;
  };
  Roll20Integration: {
    postChatMessage(message: string): void;
  };
  PopupDetection: {
    checkUrlForPopup(url: string): boolean;
    isRoll20PopupWindow(): boolean;
  };
  StorageManager: {
    saveModifierSettings(): void;
    loadModifierSettings(): boolean;
    updateModifierSettings(): void;
    clearAllModifierSettings(): void;
  };
  PixelsUtils: {
    log: typeof console.log;
    getArrayFirstElement<T>(array: ArrayLike<T> | undefined): T | undefined;
  };
  ModifierBoxDragDropManager: {
    setupDragAndDrop(modifierBox: HTMLElement): void;
    cleanup(): void;
  };

  // RowDragDrop factory
  RowDragDrop: RowDragDropFactory;
  addDragHandle(row: HTMLElement): void;
  removeDragHandle(row: HTMLElement): void;
  modifierRowDragDrop: RowDragDropInstance | undefined;

  // Legacy individual global functions
  connectToPixel(): Promise<PixelDie | null>;
  connectToPixelByName(name: string): Promise<PixelDie | null>;
  disconnectAllPixels(): void;
  getPixels(): PixelDie[];
  sendTextToExtension(txt: string): void;
  sendStatusToExtension(): Promise<void>;
  postChatMessage(message: string): void;
  showModifierBox(): Promise<void>;
  hideModifierBox(): void;
  isRoll20PopupWindow(): boolean;
  checkUrlForPopup(url: string): boolean;
  log: typeof console.log;
  getArrayFirstElement<T>(array: ArrayLike<T> | undefined): T | undefined;
  saveModifierSettings(): void;
  loadModifierSettings(): boolean;
  updateModifierSettings(): void;
  clearAllModifierSettings(): void;

  // Extension state
  pixels: PixelDie[];
  pixelsAllowUnprompted: boolean;
  pixelsAllowDiceSubstitution: boolean;
  pixelsModifier: number;
  pixelsModifierName: string;
  roll20PixelsLoaded: boolean | undefined;

  // Jest test environment
  jest: unknown;
}

// Document Picture-in-Picture API (Chrome 116+)
interface DocumentPictureInPictureWindow extends Window {
  close(): void;
}

interface DocumentPictureInPicture {
  requestWindow(options?: {
    width?: number;
    height?: number;
  }): Promise<DocumentPictureInPictureWindow>;
}

interface Window {
  documentPictureInPicture: DocumentPictureInPicture;
}
