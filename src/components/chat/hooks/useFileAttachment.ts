// src/components/chat/hooks/useFileAttachment.ts
import { useState, useRef } from "react";

export const useFileAttachment = () => {
  const [isAttachmentEnabled, setIsAttachmentEnabled] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]); // ADD THIS - track actual files
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // ADD THIS - store the actual files
      const newFiles = Array.from(files);
      setAttachments((prev) => [...prev, ...newFiles]);

      console.log("Files attached:", newFiles);
      setIsAttachmentEnabled(true);

      // Reset input so the same file can be selected again
      e.target.value = "";
    }
  };

  // ADD THIS - remove a specific attachment
  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    if (attachments.length <= 1) {
      setIsAttachmentEnabled(false);
    }
  };

  // ADD THIS - clear all attachments
  const clearAttachments = () => {
    setAttachments([]);
    setIsAttachmentEnabled(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetAttachment = () => {
    setAttachments([]);
    setIsAttachmentEnabled(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return {
    isAttachmentEnabled,
    attachments, // ADD THIS - return the files
    fileInputRef,
    handleAttachmentClick,
    handleFileChange,
    removeAttachment, // ADD THIS - remove single file
    clearAttachments, // ADD THIS - clear all files
    resetAttachment,
  };
};
