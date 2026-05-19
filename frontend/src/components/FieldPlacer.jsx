import React, { useState, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { 
  Plus, Trash2, Move, ChevronLeft, ChevronRight, 
  ZoomIn, ZoomOut, FileSignature, Type, Calendar, 
  CheckSquare, MousePointer, Loader2, Save
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const FIELD_TYPES = [
  { type: "signature", label: "Signature", icon: FileSignature, defaultWidth: 200, defaultHeight: 60 },
  { type: "initials", label: "Initials", icon: Type, defaultWidth: 100, defaultHeight: 40 },
  { type: "date", label: "Date", icon: Calendar, defaultWidth: 120, defaultHeight: 30 },
  { type: "text", label: "Text", icon: Type, defaultWidth: 150, defaultHeight: 30 },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare, defaultWidth: 30, defaultHeight: 30 },
];

export default function FieldPlacer({ documentUrl, onSave, existingFields = [], signerId = null, disabled = false }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [fields, setFields] = useState(existingFields);
  const [selectedField, setSelectedField] = useState(null);
  const [selectedFieldType, setSelectedFieldType] = useState("signature");
  const [isPlacing, setIsPlacing] = useState(false);
  const [draggedField, setDraggedField] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState(null);

  useEffect(() => {
    setFields(existingFields);
  }, [existingFields]);

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
  }, []);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));

  const addField = useCallback((pageNum, xPercent, yPercent) => {
    const fieldType = FIELD_TYPES.find((f) => f.type === selectedFieldType);
    const newField = {
      id: `temp-${Date.now()}`,
      field_type: selectedFieldType,
      page_number: pageNum,
      x_percent: xPercent,
      y_percent: yPercent,
      width_px: fieldType.defaultWidth,
      height_px: fieldType.defaultHeight,
      is_required: true,
      label: fieldType.label,
      field_order: fields.length,
      signer_id: signerId,
    };
    setFields((prev) => [...prev, newField]);
    setSelectedField(newField);
    setIsPlacing(false);
  }, [selectedFieldType, fields.length, signerId]);

  const handleCanvasClick = useCallback((e) => {
    if (!isPlacing) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    
    addField(pageNumber, xPercent, yPercent);
  }, [isPlacing, pageNumber, addField]);

  const [draggingField, setDraggingField] = useState(null);

  const updateField = useCallback((fieldId, updates) => {
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, ...updates } : f))
    );
  }, []);

  const handleFieldDragStart = useCallback((e, field) => {
    e.stopPropagation();
    setDraggingField(field);
  }, []);

  const handleResizeStart = useCallback((e, field, edge) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing({
      id: field.id,
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startW: field.width_px,
      startH: field.height_px,
    });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (resizing) {
      const dx = e.clientX - resizing.startX;
      const dy = e.clientY - resizing.startY;
      let newW = resizing.startW;
      let newH = resizing.startH;
      if (resizing.edge.includes("e")) newW = Math.max(30, resizing.startW + dx);
      if (resizing.edge.includes("s")) newH = Math.max(20, resizing.startH + dy);
      updateField(resizing.id, { width_px: newW, height_px: newH });
      return;
    }

    if (!draggingField) return;
    
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    
    updateField(draggingField.id, { x_percent: xPercent, y_percent: yPercent });
  }, [resizing, draggingField, updateField]);

  const handleMouseUp = useCallback(() => {
    setDraggingField(null);
    setResizing(null);
  }, []);

  const deleteField = useCallback((fieldId) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }
  }, [selectedField]);

  const handleSave = useCallback(() => {
    const cleanFields = fields.map((f) => ({
      ...f,
      signer_id: signerId,
    }));
    onSave?.(cleanFields);
  }, [fields, onSave, signerId]);

  const pageFields = fields.filter((f) => f.page_number === pageNumber);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-amber-900/20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPageNumber((p) => Math.max(p - 1, 1))}
              disabled={pageNumber <= 1}
              className="p-1 rounded hover:bg-amber-600/20 disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5 text-amber-200" />
            </button>
            <span className="text-sm text-amber-100/70">
              Page {pageNumber} of {numPages || "?"}
            </span>
            <button
              onClick={() => setPageNumber((p) => Math.min(p + 1, numPages || 1))}
              disabled={pageNumber >= (numPages || 1)}
              className="p-1 rounded hover:bg-amber-600/20 disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5 text-amber-200" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleZoomOut} className="p-1 rounded hover:bg-amber-600/20">
              <ZoomOut className="w-5 h-5 text-amber-200" />
            </button>
            <span className="text-sm text-amber-100/50 w-16 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={handleZoomIn} className="p-1 rounded hover:bg-amber-600/20">
              <ZoomIn className="w-5 h-5 text-amber-200" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPlacing ? (
            <button
              onClick={() => setIsPlacing(false)}
              className="px-3 py-1.5 rounded bg-red-600/20 text-red-200 text-sm hover:bg-red-600/30"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => setIsPlacing(true)}
              className="px-3 py-1.5 rounded bg-amber-600 text-black text-sm flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add Field
            </button>
          )}
        </div>
      </div>

      {isPlacing && (
        <div className="px-4 py-2 bg-amber-600/10 border-b border-amber-600/30 flex items-center gap-2">
          <span className="text-sm text-amber-200">Click on the document to place a field:</span>
          <div className="flex gap-1">
            {FIELD_TYPES.map((ft) => (
              <button
                key={ft.type}
                onClick={() => setSelectedFieldType(ft.type)}
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                  selectedFieldType === ft.type
                    ? "bg-amber-600 text-black"
                    : "bg-amber-600/20 text-amber-200"
                }`}
              >
                <ft.icon className="w-3 h-3" />
                {ft.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 flex gap-4">
        <div className="flex-1 flex justify-center">
          {!documentUrl ? (
            <div className="flex items-center justify-center" style={{ width: 600, height: 848 }}>
              <div className="text-center">
                <FileText className="w-10 h-10 text-amber-400/40 mx-auto mb-3" />
                <p className="text-amber-100/50 text-sm">No document to display</p>
              </div>
            </div>
          ) : (
            <>
<div 
              className={`relative cursor-${isPlacing ? "crosshair" : draggingField ? "grabbing" : "default"}`}
              style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <Document
                file={documentUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center justify-center" style={{ width: 600, height: 848 }}>
                    <div className="text-center">
                      <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto mb-4" />
                      <p className="text-amber-100/60 text-sm">Loading document...</p>
                    </div>
                  </div>
                }
                error={
                  <div className="flex items-center justify-center" style={{ width: 600, height: 848 }}>
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-3">
                        <Loader2 className="w-6 h-6 text-red-400" />
                      </div>
                      <p className="text-red-200 text-sm">Failed to load PDF</p>
                    </div>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  width={600}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  className="shadow-2xl"
                />
              </Document>

              {pageFields.map((field) => {
                const isSelected = selectedField?.id === field.id;
                const Icon = FIELD_TYPES.find((f) => f.type === field.field_type)?.icon || MousePointer;
                
                return (
                  <div
                    key={field.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedField(field);
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleFieldDragStart(e, field);
                    }}
                    className={`
                      absolute cursor-move transition-all
                      ${isSelected 
                        ? "bg-amber-500/50 border-2 border-amber-400 shadow-lg shadow-amber-900/30" 
                        : "bg-amber-600/60 border border-amber-400/70 shadow-md hover:bg-amber-500/70"
                      }
                      rounded flex items-center justify-center z-10
                    `}
                    style={{
                      left: `${field.x_percent}%`,
                      top: `${field.y_percent}%`,
                      width: field.width_px,
                      height: field.height_px,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div className="flex items-center gap-1 text-amber-950 text-[11px] font-medium px-1 leading-tight">
                      <Icon className="w-3 h-3 shrink-0" />
                      <span className="truncate">{field.label}</span>
                      {field.is_required && <span className="text-red-600">*</span>}
                    </div>
                    {isSelected && (
                      <>
                        <div
                          onMouseDown={(e) => handleResizeStart(e, field, "e")}
                          className="absolute top-1/2 -right-1 w-2 h-5 bg-amber-400 border border-amber-950 rounded-sm -translate-y-1/2 cursor-e-resize z-20"
                        />
                        <div
                          onMouseDown={(e) => handleResizeStart(e, field, "s")}
                          className="absolute -bottom-1 left-1/2 h-2 w-5 bg-amber-400 border border-amber-950 rounded-sm -translate-x-1/2 cursor-s-resize z-20"
                        />
                        <div
                          onMouseDown={(e) => handleResizeStart(e, field, "se")}
                          className="absolute -bottom-1 -right-1 w-3 h-3 bg-amber-400 border border-amber-950 rounded-sm cursor-se-resize z-20"
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>

        <div className="w-64 bg-[#0f1422] border-l border-amber-900/20 p-4 overflow-y-auto">
          <h3 className="text-sm text-amber-200 mb-3">Fields ({fields.length})</h3>
          
          {fields.length === 0 ? (
            <p className="text-xs text-amber-100/50">
              Click "Add Field" and then click on the document to place signature fields.
            </p>
          ) : (
            <div className="space-y-2">
              {fields.map((field) => {
                const Icon = FIELD_TYPES.find((f) => f.type === field.field_type)?.icon || MousePointer;
                return (
                  <div
                    key={field.id}
                    onClick={() => {
                      setSelectedField(field);
                      setPageNumber(field.page_number);
                    }}
                    className={`
                      p-2 rounded cursor-pointer flex items-center gap-2
                      ${selectedField?.id === field.id 
                        ? "bg-amber-600/20 border border-amber-600/50" 
                        : "bg-black/20 border border-amber-900/30 hover:bg-amber-600/10"
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 text-amber-400" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-amber-100 truncate">{field.label}</div>
                      <div className="text-[10px] text-amber-100/50">
                        Page {field.page_number}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteField(field.id);
                      }}
                      className="p-1 text-amber-100/30 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {selectedField && (
            <div className="mt-4 p-3 bg-black/20 rounded-lg border border-amber-900/30">
              <h4 className="text-xs text-amber-200 mb-2">Field Properties</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-amber-100/70">
                  <input
                    type="checkbox"
                    checked={selectedField.is_required}
                    onChange={(e) => updateField(selectedField.id, { is_required: e.target.checked })}
                    className="w-3 h-3 rounded"
                  />
                  Required
                </label>
                <input
                  type="text"
                  value={selectedField.label || ""}
                  onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                  placeholder="Label"
                  className="w-full bg-black/40 border border-amber-900/30 rounded px-2 py-1 text-xs text-amber-50"
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] text-amber-100/50 mb-1">W</label>
                    <input
                      type="number"
                      min={30}
                      value={Math.round(selectedField.width_px)}
                      onChange={(e) => updateField(selectedField.id, { width_px: Math.max(30, Number(e.target.value)) })}
                      className="w-full bg-black/40 border border-amber-900/30 rounded px-2 py-1 text-xs text-amber-50"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-amber-100/50 mb-1">H</label>
                    <input
                      type="number"
                      min={20}
                      value={Math.round(selectedField.height_px)}
                      onChange={(e) => updateField(selectedField.id, { height_px: Math.max(20, Number(e.target.value)) })}
                      className="w-full bg-black/40 border border-amber-900/30 rounded px-2 py-1 text-xs text-amber-50"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={fields.length === 0 || disabled}
            className="w-full mt-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save Fields
          </button>
        </div>
      </div>
    </div>
  );
}