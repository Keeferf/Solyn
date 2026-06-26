import { useState, useRef } from "react";

export const useFileAttachment = () => {
  const [isAttachmentEnabled, setIsAttachmentEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      console.log("Files attached:", files);
      setIsAttachmentEnabled(true);
      e.target.value = "";
    }
  };

  const resetAttachment = () => {
    setIsAttachmentEnabled(false);
  };

  return {
    isAttachmentEnabled,
    fileInputRef,
    handleAttachmentClick,
    handleFileChange,
    resetAttachment,
  };
};
