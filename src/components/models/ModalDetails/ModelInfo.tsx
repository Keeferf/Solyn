// src/components/models/ModalDetails/ModelInfo.tsx
import { FiUser, FiDownloadCloud, FiHeart } from "react-icons/fi";
import { formatDownloads } from "../utils/modalUtils";

export const ModelInfo = ({
  details,
}: {
  details: {
    name?: string;
    model_id: string;
    author?: string;
    downloads?: number;
    likes?: number;
  };
}) => (
  <div className="flex-1 min-w-0">
    <h3 className="text-xl font-bold text-[#d8d4cf] truncate">
      {details.name || details.model_id}
    </h3>
    <div className="flex items-center gap-3 mt-1">
      {details.author && (
        <div className="flex items-center gap-1 text-[#d8d4cf]/40 text-sm">
          <FiUser size={14} />
          <span>{details.author}</span>
        </div>
      )}
      {details.downloads !== undefined && details.downloads > 0 && (
        <div className="flex items-center gap-1 text-[#d8d4cf]/40 text-sm">
          <FiDownloadCloud size={14} />
          <span>{formatDownloads(details.downloads)}</span>
        </div>
      )}
      {details.likes !== undefined && details.likes > 0 && (
        <div className="flex items-center gap-1 text-[#d8d4cf]/40 text-sm">
          <FiHeart size={14} />
          <span>{details.likes}</span>
        </div>
      )}
    </div>
  </div>
);
