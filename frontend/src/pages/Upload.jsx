import React, { useState, useRef } from "react";
import { Upload, FileText, Image as ImageIcon, X, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { StatusPill } from "../components/UI.jsx";
import { documents } from "../api.js";
import { fmtBytes } from "../lib.js";

const ACCEPTED_TYPES = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/rtf": ".rtf",
  "text/plain": ".txt",
  "application/vnd.oasis.opendocument.text": ".odt",
  "application/vnd.oasis.opendocument.spreadsheet": ".ods",
  "application/vnd.oasis.opendocument.presentation": ".odp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/bmp": ".bmp",
  "image/tiff": ".tif",
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function getFileExtension(file) {
  return ACCEPTED_TYPES[file.type] || "." + file.name.split(".").pop().toLowerCase();
}

function getFileCategory(file) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  if (file.type.includes("word") || file.type.includes("document")) return "doc";
  if (file.type.includes("excel") || file.type.includes("spreadsheet")) return "excel";
  if (file.type.includes("powerpoint") || file.type.includes("presentation")) return "ppt";
  return "other";
}

export default function UploadPage({ ctx, onBack }) {
  const { t, lang, fontStack, monoFont, showToast, setView } = ctx;
  const [file, setFile] = useState(null);
  const [docName, setDocName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [uploadedDoc, setUploadedDoc] = useState(null);
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    if (!ACCEPTED_TYPES[file.type]) {
      return lang === "he"
        ? "סוג קובץ לא נתמך. אנא העלה קובץ PDF, Word, Excel, PowerPoint, או תמונה."
        : "Unsupported file type. Please upload a PDF, Word, Excel, PowerPoint, or image.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return lang === "he"
        ? `הקובץ גדול מדי. הגודל המקסימלי הוא ${fmtBytes(MAX_FILE_SIZE)}.`
        : `File too large. Maximum size is ${fmtBytes(MAX_FILE_SIZE)}.`;
    }
    return null;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleFileSelect = (selectedFile) => {
    setError(null);
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }
    setFile(selectedFile);
    if (!docName) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      setDocName(nameWithoutExt);
    }
  };

  const handleFileInputChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!file || !docName.trim()) {
      setError(lang === "he" ? "נא לבחור קובץ ולהזין שם." : "Please select a file and enter a name.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const result = await documents.upload(file, docName.trim());
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadedDoc(result);
      showToast(t.toasts.docCreated);
      
      setTimeout(() => {
        setView("userDocuments");
      }, 1500);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err.message || (lang === "he" ? "העלאה נכשלה" : "Upload failed"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setView("userDocuments");
    }
  };

  const FileIcon = file
    ? getFileCategory(file) === "image"
      ? ImageIcon
      : FileText
    : Upload;

  if (uploadedDoc) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <div>
          <h2 style={{ fontFamily: fontStack }} className="text-2xl font-light text-amber-50 mb-2">
            {lang === "he" ? "המסמך הועלה בהצלחה!" : "Document uploaded successfully!"}
          </h2>
          <p className="text-amber-100/60">{uploadedDoc.name}</p>
        </div>
        <StatusPill status="draft" t={t} />
        <p className="text-sm text-amber-100/40">
          {lang === "he" ? "מעבר לרשימת המסמכים..." : "Redirecting to documents..."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-amber-100/60 hover:text-amber-100 text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {lang === "he" ? "חזרה למסמכים" : "Back to Documents"}
      </button>

      <div>
        <h1 style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50">
          {lang === "he" ? "העלאת מסמך" : "Upload Document"}
        </h1>
        <p className="text-amber-100/60 text-sm mt-1">
          {lang === "he"
            ? "גרור קובץ לכאן או לחץ לבחירה"
            : "Drag a file here or click to browse"}
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
          ${isDragging
            ? "border-amber-500 bg-amber-500/10"
            : file
              ? "border-emerald-500/50 bg-emerald-500/5"
              : "border-amber-900/40 bg-black/20 hover:border-amber-600/60 hover:bg-amber-950/10"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={Object.keys(ACCEPTED_TYPES).join(",")}
          onChange={handleFileInputChange}
          className="hidden"
        />

        {file ? (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-lg bg-amber-600/10 border border-amber-600/30 flex items-center justify-center">
              <FileIcon className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <p className="text-amber-50 font-medium truncate max-w-xs mx-auto">{file.name}</p>
              <p className="text-sm text-amber-100/50" style={{ fontFamily: monoFont }}>
                {fmtBytes(file.size)}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFile();
              }}
              className="flex items-center gap-1 mx-auto text-sm text-amber-100/50 hover:text-amber-100 transition-colors"
            >
              <X className="w-4 h-4" />
              {lang === "he" ? "הסר" : "Remove"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-600/10 border border-amber-600/30 flex items-center justify-center">
              <Upload className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <p className="text-amber-50">
                {lang === "he" ? "גרור קובץ לכאן" : "Drag and drop a file here"}
              </p>
              <p className="text-sm text-amber-100/40 mt-1">
                {lang === "he" ? "או לחץ לבחירת קובץ" : "or click to select a file"}
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div>
        <label className="block text-sm text-amber-100/70 mb-2">
          {lang === "he" ? "שם המסמך" : "Document Name"}
        </label>
        <input
          type="text"
          value={docName}
          onChange={(e) => setDocName(e.target.value)}
          placeholder={lang === "he" ? "הזן שם למסמך..." : "Enter document name..."}
          className="w-full bg-black/40 border border-amber-900/30 rounded-md px-4 py-3 text-amber-50 placeholder:text-amber-100/30 focus:border-amber-600/60 focus:outline-none"
        />
      </div>

      <div className="p-4 rounded-lg bg-black/20 border border-amber-900/20">
        <h3 className="text-sm text-amber-100/70 mb-2">
          {lang === "he" ? "פורמטים נתמכים" : "Supported formats"}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs" style={{ fontFamily: monoFont }}>
          {[
            "PDF", "Word", "Excel", "PowerPoint",
            "RTF", "TXT", "ODT/ODS/ODP", "Images"
          ].map((fmt) => (
            <div key={fmt} className="text-amber-100/40">{fmt}</div>
          ))}
        </div>
        <p className="text-xs text-amber-100/30 mt-2" style={{ fontFamily: monoFont }}>
          {lang === "he"
            ? `גודל מקסימלי: ${fmtBytes(MAX_FILE_SIZE)}`
            : `Maximum file size: ${fmtBytes(MAX_FILE_SIZE)}`}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleUpload}
          disabled={!file || !docName.trim() || isUploading}
          className={`
            flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-md font-medium text-sm transition-all
            ${!file || !docName.trim() || isUploading
              ? "bg-amber-600/20 text-amber-100/40 cursor-not-allowed"
              : "bg-amber-600 hover:bg-amber-500 text-black"
            }
          `}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {lang === "he" ? "מעלה..." : "Uploading..."} {uploadProgress}%
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              {lang === "he" ? "העלה מסמך" : "Upload Document"}
            </>
          )}
        </button>
        <button
          onClick={handleBack}
          className="px-6 py-3 rounded-md border border-amber-900/30 text-amber-100/70 hover:text-amber-100 hover:border-amber-600/60 text-sm transition-all"
        >
          {t.common.cancel}
        </button>
      </div>

      {isUploading && uploadProgress > 0 && (
        <div className="h-1.5 bg-amber-900/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}