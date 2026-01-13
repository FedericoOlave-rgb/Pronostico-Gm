import React from 'react';
import { UploadCloud } from 'lucide-react';

interface FileUploadProps {
  label: string;
  accept: string;
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
}

const FileUpload: React.FC<FileUploadProps> = ({ label, accept, onFileSelect, selectedFile }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className={`relative border-2 border-dashed rounded-lg p-4 transition-colors ${selectedFile ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-blue-400 bg-white'}`}>
        <input 
          type="file" 
          accept={accept}
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${selectedFile ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
            <UploadCloud size={20} />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-slate-900 truncate">
              {selectedFile ? selectedFile.name : "Choose file..."}
            </p>
            <p className="text-xs text-slate-500">
              {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : "XLSX, XLS, CSV"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;