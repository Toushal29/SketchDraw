import { createSignal } from "solid-js";

export function createDialogState() {
  const [renameFileOpen, setRenameFileOpen] = createSignal(false);
  const [styleLibraryOpen, setStyleLibraryOpen] = createSignal(false);
  const [outlineOpen, setOutlineOpen] = createSignal(false);
  const [navigatorOpen, setNavigatorOpen] = createSignal(false);
  const [dataPanelOpen, setDataPanelOpen] = createSignal(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false);
  const [diagramGuidesOpen, setDiagramGuidesOpen] = createSignal(false);
  const [shortcutDialogOpen, setShortcutDialogOpen] = createSignal(false);
  const [showPressureCurve, setShowPressureCurve] = createSignal(false);
  const [designWorkbenchOpen, setDesignWorkbenchOpen] = createSignal(false);
  const [layerPanelOpen, setLayerPanelOpen] = createSignal(false);
  const [helpOpen, setHelpOpen] = createSignal(false);
  const [toolBarOpen, setToolBarOpen] = createSignal(true);
  const [mobileQuickPropertiesOpen, setMobileQuickPropertiesOpen] = createSignal(false);
  const [touchStylePanel, setTouchStylePanel] = createSignal(false);
  const [showClearConfirm, setShowClearConfirm] = createSignal(false);
  const [exportOptionsOpen, setExportOptionsOpen] = createSignal(false);
  const [canvasOptionsOpen, setCanvasOptionsOpen] = createSignal(false);
  const [toolbarOrganizerOpen, setToolbarOrganizerOpen] = createSignal(false);
  const [moreToolsOpen, setMoreToolsOpen] = createSignal(false);
  const [moreBrushPickerOpen, setMoreBrushPickerOpen] = createSignal(false);
  const [schemaDialog, setSchemaDialog] = createSignal(false);
  const [validationOpen, setValidationOpen] = createSignal(false);
  const [bpmnSimulationOpen, setBpmnSimulationOpen] = createSignal(false);
  const [namedSnapshotsOpen, setNamedSnapshotsOpen] = createSignal(false);
  const [objectSearchOpen, setObjectSearchOpen] = createSignal(false);
  const [mermaidDialog, setMermaidDialog] = createSignal(false);
  const [codeDataOpen, setCodeDataOpen] = createSignal(false);
  const [diagramSourcePreviewOpen, setDiagramSourcePreviewOpen] = createSignal(false);
  const [csvChartOpen, setCsvChartOpen] = createSignal(false);
  const [diagramCodeExportOpen, setDiagramCodeExportOpen] = createSignal(false);
  const [blueprintExportOpen, setBlueprintExportOpen] = createSignal(false);
  const [webEmbedDialog, setWebEmbedDialog] = createSignal(false);
  const [componentLibraryOpen, setComponentLibraryOpen] = createSignal(false);

  return {
    renameFileOpen, setRenameFileOpen,
    styleLibraryOpen, setStyleLibraryOpen,
    outlineOpen, setOutlineOpen,
    navigatorOpen, setNavigatorOpen,
    dataPanelOpen, setDataPanelOpen,
    commandPaletteOpen, setCommandPaletteOpen,
    diagramGuidesOpen, setDiagramGuidesOpen,
    shortcutDialogOpen, setShortcutDialogOpen,
    showPressureCurve, setShowPressureCurve,
    designWorkbenchOpen, setDesignWorkbenchOpen,
    layerPanelOpen, setLayerPanelOpen,
    helpOpen, setHelpOpen,
    toolBarOpen, setToolBarOpen,
    mobileQuickPropertiesOpen, setMobileQuickPropertiesOpen,
    touchStylePanel, setTouchStylePanel,
    showClearConfirm, setShowClearConfirm,
    exportOptionsOpen, setExportOptionsOpen,
    canvasOptionsOpen, setCanvasOptionsOpen,
    toolbarOrganizerOpen, setToolbarOrganizerOpen,
    moreToolsOpen, setMoreToolsOpen,
    moreBrushPickerOpen, setMoreBrushPickerOpen,
    schemaDialog, setSchemaDialog,
    validationOpen, setValidationOpen,
    bpmnSimulationOpen, setBpmnSimulationOpen,
    namedSnapshotsOpen, setNamedSnapshotsOpen,
    objectSearchOpen, setObjectSearchOpen,
    mermaidDialog, setMermaidDialog,
    codeDataOpen, setCodeDataOpen,
    diagramSourcePreviewOpen, setDiagramSourcePreviewOpen,
    csvChartOpen, setCsvChartOpen,
    diagramCodeExportOpen, setDiagramCodeExportOpen,
    blueprintExportOpen, setBlueprintExportOpen,
    webEmbedDialog, setWebEmbedDialog,
    componentLibraryOpen, setComponentLibraryOpen,
  };
}

export type DialogState = ReturnType<typeof createDialogState>;
