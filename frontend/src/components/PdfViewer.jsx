import React, { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ 
  url, 
  fields = [], 
  fieldValues = {}, 
  onFieldClick,
  onDrop,
  readOnly = false,
  highlightFields = true 
}) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
  }, []);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  
  const goToPrev = () => setPageNumber((p) => Math.max(p - 1, 1));
  const goToNext = () => setPageNumber((p) => Math.min(p + 1, numPages || 1));

  const pageFields = fields.filter((f) => f.page_number === pageNumber);

  const getFieldValue = (fieldId) => fieldValues[fieldId] || null;
  const isFieldFilled = (field) => {
    const value = getFieldValue(field.id);
    return value !== null && value !== undefined && value !== "";
  };

  const renderFieldContent = (field) => {
    const value = getFieldValue(field.id);
    
    switch (field.field_type) {
      case "signature":
        return value ? (
          <div className="w-full h-full flex items-center justify-center bg-white">
            <img src={value} alt="Signature" className="max-w-full max-h-full object-contain" />
          </div>
        ) : null;
      case "initials":
        return value ? (
          <span className="text-lg font-script" style={{ fontFamily: "cursive" }}>{value}</span>
        ) : null;
      case "date":
        return value || "Select date";
      case "text":
        return value || "Enter text";
      case "checkbox":
        return value === "true" || value === true ? (
          <span className="text-emerald-400">✓</span>
        ) : "☐";
      default:
        return value || field.label || "";
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-amber-900/20">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            disabled={pageNumber <= 1}
            className="p-1 rounded hover:bg-amber-600/20 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5 text-amber-200" />
          </button>
          <span className="text-sm text-amber-100/70">
            {pageNumber} / {numPages || "?"}
          </span>
          <button
            onClick={goToNext}
            disabled={pageNumber >= (numPages || 1)}
            className="p-1 rounded hover:bg-amber-600/20 disabled:opacity-30 disabled:cursor-not-allowed"
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

      <div className="flex-1 overflow-auto p-4 flex justify-center">
        <div 
          className="relative" 
          style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
          onDrop={(e) => {
            e.preventDefault();
            if (onDrop && fields.length > 0) {
              const sigField = fields.find(f => f.field_type === "signature" && !fieldValues[f.id]);
              if (sigField) {
                onDrop(e, sigField);
              }
            }
          }}
        >
          <Document
            file={url}
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
            const filled = isFieldFilled(field);
            const canDrop = !readOnly && (field.field_type === "signature" || field.field_type === "initials");
            
            const handleDrop = (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (canDrop && onDrop) {
                onDrop(e, field);
              }
            };
            
            const handleDragOver = (e) => {
              if (canDrop) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }
            };
            
            return (
              <div
                key={field.id}
                onClick={() => !readOnly && onFieldClick?.(field)}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className={`
                  absolute cursor-pointer transition-all
                  ${filled ? "bg-emerald-500/20 border-emerald-500" : "bg-amber-500/20 border-amber-500 hover:bg-amber-500/30"}
                  border-2 rounded
                  ${canDrop ? "drop-zone" : ""}
                `}
                style={{
                  left: `${field.x_percent}%`,
                  top: `${field.y_percent}%`,
                  width: field.width_px,
                  height: field.height_px,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div className="w-full h-full flex items-center justify-center text-center text-xs p-1 overflow-hidden">
                  {readOnly ? (
                    renderFieldContent(field)
                  ) : filled ? (
                    renderFieldContent(field)
                  ) : (
                    <span className="text-amber-100/60 text-[10px]">
                      {field.field_type === "signature" && "Drop signature here"}
                      {field.field_type === "initials" && "Drop initials here"}
                      {field.field_type === "date" && "Click to select date"}
                      {field.field_type === "text" && "Click to enter text"}
                      {field.field_type === "checkbox" && "Click to check"}
                    </span>
                  )}
                </div>
                
                {field.is_required && !filled && highlightFields && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {fields.length > 0 && (
        <div className="px-4 py-2 bg-black/40 border-t border-amber-900/20 text-xs text-amber-100/50">
          {fields.length} field{fields.length !== 1 ? "s" : ""} on document
          {" · "}
          {fields.filter((f) => isFieldFilled(f)).length} filled
        </div>
      )}
    </div>
  );
}