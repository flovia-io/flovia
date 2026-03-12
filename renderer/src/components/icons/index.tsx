// Shared SVG Icon Components with optional size props

interface IconProps {
  size?: number;
  className?: string;
}

export const GitIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M15.698 7.287L8.712.302a1.03 1.03 0 0 0-1.457 0L5.632 1.925l1.221 1.221a1.2 1.2 0 0 1 1.532 1.532l1.176 1.176a1.2 1.2 0 0 1 1.295 2.015 1.2 1.2 0 0 1-2.015-1.295L7.432 5.888v3.055a1.2 1.2 0 1 1-1.766-1.053V5.888a1.2 1.2 0 0 1-.665-1.608L4.432 3.104.302 7.234a1.03 1.03 0 0 0 0 1.457l6.986 6.986a1.03 1.03 0 0 0 1.457 0l6.953-6.953a1.03 1.03 0 0 0 0-1.457z"/>
  </svg>
);

export const NpmIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M0 0v16h16V0H0zm13 13h-2V8h-2v5H5V3h8v10z"/>
  </svg>
);

export const TerminalIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M2 3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2zm0 1h12v8H2V4zm2.5 1.5L3 7l1.5 1.5.7-.7L4.4 7l.8-.8-.7-.7zM6 8v1h4V8H6z"/>
  </svg>
);

export const PromptsIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M14 1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 14V2h12v12H2zM4 4h8v1H4V4zm0 2h8v1H4V6zm0 2h6v1H4V8z"/>
  </svg>
);

export const NewWindowIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M3 3v10h10V3H3zm9 9H4V4h8v8zM1 1v12h1V2h11V1H1z"/>
  </svg>
);

export const ExplorerIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M1.5 1H7l1 2h6.5l.5.5v10l-.5.5h-13l-.5-.5v-12l.5-.5zM2 3v9h12V4H7.69l-1-2H2z"/>
  </svg>
);

export const SearchIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M15.25 14.19l-4.22-4.22a5.5 5.5 0 1 0-1.06 1.06l4.22 4.22a.75.75 0 1 0 1.06-1.06zM2 6.5a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0z"/>
  </svg>
);

export const ChevronLeftIcon = ({ size = 12, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M10 3.5a.5.5 0 0 0-.82-.38l-4 3.5a.5.5 0 0 0 0 .76l4 3.5A.5.5 0 0 0 10 10.5v-7z"/>
  </svg>
);

export const ChevronRightIcon = ({ size = 12, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M6 3.5a.5.5 0 0 1 .82-.38l4 3.5a.5.5 0 0 1 0 .76l-4 3.5A.5.5 0 0 1 6 10.5v-7z"/>
  </svg>
);

export const SettingsIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
    <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z"/>
  </svg>
);

export const PlusIcon = ({ size = 14, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
  </svg>
);

export const TrashIcon = ({ size = 14, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
    <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
  </svg>
);

export const CloseIcon = ({ size = 12, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
  </svg>
);

export const RefreshIcon = ({ size = 14, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
  </svg>
);

export const CheckIcon = ({ size = 14, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
  </svg>
);

export const HistoryIcon = ({ size = 14, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M8.515 1.019A7 7 0 0 0 1 7.5H0l2 2.5 2-2.5H2.5a5.5 5.5 0 1 1 .928 3.072.5.5 0 0 0-.864.504A6.5 6.5 0 1 0 8.515 1.019z"/>
    <path d="M7.5 4v4.5l3 1.5.5-.866L8 7.614V4H7.5z"/>
  </svg>
);

export const BranchIcon = ({ size = 14, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z"/>
  </svg>
);

// Additional icons for Chat and other components

export const SendIcon = ({ size = 14, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M1.724 1.053a.5.5 0 0 1 .541-.054l12 6.5a.5.5 0 0 1 0 .882l-12 6.5A.5.5 0 0 1 1.5 14.5v-5.191l7.72-1.31L1.5 6.69V1.5a.5.5 0 0 1 .224-.447z"/>
  </svg>
);

export const StopIcon = ({ size = 14, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <rect x="3" y="3" width="10" height="10" rx="1.5" />
  </svg>
);

export const MicrophoneIcon = ({ size = 15, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M8 11a3 3 0 0 0 3-3V3a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z"/>
    <path d="M12 8a.5.5 0 0 1 .5.5A4.5 4.5 0 0 1 8.5 13v1.5h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2V13A4.5 4.5 0 0 1 3.5 8.5a.5.5 0 0 1 1 0A3.5 3.5 0 0 0 8 12a3.5 3.5 0 0 0 3.5-3.5.5.5 0 0 1 .5-.5z"/>
  </svg>
);

export const ClockIcon = ({ size = 15, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M8 3.5a.5.5 0 0 0-1 0V8a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 7.71V3.5z"/>
    <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
  </svg>
);

export const KeyboardIcon = ({ size = 15, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M14 5H2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM2 4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H2z"/>
    <path d="M13 10.25a.25.25 0 0 1 .25-.25h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25v-.5zm0-2a.25.25 0 0 1 .25-.25h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25v-.5zm-5 0A.25.25 0 0 1 8.25 8h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5A.25.25 0 0 1 8 8.75v-.5z"/>
  </svg>
);

export const FolderIcon = ({ size = 15, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.879a1.5 1.5 0 0 1 1.06.44l1.122 1.12A.5.5 0 0 0 8.914 4H13.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"/>
  </svg>
);

export const AddFileIcon = ({ size = 14, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M11.5 1a.5.5 0 0 1 .5.5V4h2.5a.5.5 0 0 1 0 1H12v2.5a.5.5 0 0 1-1 0V5H8.5a.5.5 0 0 1 0-1H11V1.5a.5.5 0 0 1 .5-.5z"/>
    <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2H8v1H3.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V8h1v4.5A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-9z"/>
  </svg>
);

export const DebugIcon = ({ size = 14, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M8 1a5 5 0 0 0-5 5v1H2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1v.5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5V13h1a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1V6a5 5 0 0 0-5-5zM4 6a4 4 0 1 1 8 0v1H4V6zm1 3h6v4.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5V9z"/>
    <circle cx="6" cy="10.5" r=".75"/>
    <circle cx="10" cy="10.5" r=".75"/>
  </svg>
);

export const ClearIcon = ({ size = 14, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
    <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
  </svg>
);

export const ChatIcon = ({ size = 14, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M14 1H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3v2.5a.5.5 0 0 0 .854.354L9.207 13H14a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z"/>
  </svg>
);

export const RobotIcon = ({ size = 16, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M6 12.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zM3 8.062C3 6.76 4.235 5.765 5.53 5.886a26.58 26.58 0 0 0 4.94 0C11.765 5.765 13 6.76 13 8.062v1.157a.933.933 0 0 1-.765.935c-.845.147-2.34.346-4.235.346-1.895 0-3.39-.2-4.235-.346A.933.933 0 0 1 3 9.219V8.062zm4.542-.827a.25.25 0 0 0-.217.068l-.92.9a24.767 24.767 0 0 1-1.871-.183.25.25 0 0 0-.068.495c.55.076 1.232.149 2.02.193a.25.25 0 0 0 .189-.071l.754-.736.847 1.71a.25.25 0 0 0 .404.062l.932-.97a25.286 25.286 0 0 0 1.922-.188.25.25 0 0 0-.068-.495c-.538.074-1.207.145-1.98.189a.25.25 0 0 0-.166.076l-.754.785-.842-1.7a.25.25 0 0 0-.182-.135z"/>
    <path d="M8.5 1.866a1 1 0 1 0-1 0V3h-2A4.5 4.5 0 0 0 1 7.5V8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1v-.5A4.5 4.5 0 0 0 10.5 3h-2V1.866z"/>
  </svg>
);

export const SpinnerIcon = ({ size = 14, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={`spinner ${className}`}>
    <path d="M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0v1z"/>
  </svg>
);

export const ChevronDownIcon = ({ size = 12, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
  </svg>
);

export const ChevronUpIcon = ({ size = 12, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/>
  </svg>
);

export const EditIcon = ({ size = 14, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
  </svg>
);

export const CollapseIcon = ({ size = 12, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M6 3.5a.5.5 0 0 1 .82-.38l4 3.5a.5.5 0 0 1 0 .76l-4 3.5A.5.5 0 0 1 6 10.5v-7z"/>
  </svg>
);

export const ExpandIcon = ({ size = 12, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M10 3.5a.5.5 0 0 0-.82-.38l-4 3.5a.5.5 0 0 0 0 .76l4 3.5A.5.5 0 0 0 10 10.5v-7z"/>
  </svg>
);

export const BackIcon = ({ size = 12, className }: IconProps) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className}>
    <path d="M11 1L5 8l6 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const SupabaseIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 109 113" fill="none" className={className}>
    <path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874L63.708 110.284z" fill="#3ECF8E"/>
    <path d="M45.317 2.071c2.86-3.601 8.657-1.628 8.726 2.97l.442 67.251H9.83c-8.19 0-12.759-9.46-7.665-15.875L45.317 2.072z" fill="#3ECF8E" fillOpacity=".6"/>
  </svg>
);

export const DatabaseIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <ellipse cx="8" cy="3.5" rx="6" ry="2.5"/>
    <path d="M2 3.5v3c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5v-3"/>
    <path d="M2 6.5v3c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5v-3"/>
    <path d="M2 9.5v3c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5v-3"/>
  </svg>
);

export const PlayIcon = ({ size = 14, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M4 2.5a.5.5 0 0 1 .77-.42l9 5.5a.5.5 0 0 1 0 .84l-9 5.5A.5.5 0 0 1 4 13.5v-11z"/>
  </svg>
);

export const TableIcon = ({ size = 14, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm15 2h-4v3h4V4zm0 4h-4v3h4V8zm0 4h-4v3h3a1 1 0 0 0 1-1v-2zm-5 3v-3H6v3h4zm-5 0v-3H1v2a1 1 0 0 0 1 1h3zm-4-4h4V8H1v3zm0-4h4V4H1v3zm5-3v3h4V4H6zm4 4H6v3h4V8z"/>
  </svg>
);

export const SqlFileIcon = ({ size = 14, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
    <path d="M5.5 11.5A1.5 1.5 0 0 1 7 10h2a1.5 1.5 0 0 1 0 3H7a1.5 1.5 0 0 1-1.5-1.5z"/>
  </svg>
);

export const AgentsIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M8 1a2 2 0 0 1 2 2v1h1.5A1.5 1.5 0 0 1 13 5.5v1A1.5 1.5 0 0 1 11.5 8H10v1h1.5A1.5 1.5 0 0 1 13 10.5v1a1.5 1.5 0 0 1-1.5 1.5H10v1a2 2 0 1 1-4 0v-1H4.5A1.5 1.5 0 0 1 3 11.5v-1A1.5 1.5 0 0 1 4.5 9H6V8H4.5A1.5 1.5 0 0 1 3 6.5v-1A1.5 1.5 0 0 1 4.5 4H6V3a2 2 0 0 1 2-2zm0 1a1 1 0 0 0-1 1v1.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h2a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-2a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h2a.5.5 0 0 1 .5.5V14a1 1 0 1 0 2 0v-1.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-2a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-2a.5.5 0 0 1-.5-.5V3a1 1 0 0 0-1-1z"/>
  </svg>
);

export const McpIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M2.5 2A1.5 1.5 0 0 0 1 3.5v2A1.5 1.5 0 0 0 2.5 7h3A1.5 1.5 0 0 0 7 5.5v-2A1.5 1.5 0 0 0 5.5 2h-3zM2 3.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-2z"/>
    <path d="M10.5 2A1.5 1.5 0 0 0 9 3.5v2A1.5 1.5 0 0 0 10.5 7h3A1.5 1.5 0 0 0 15 5.5v-2A1.5 1.5 0 0 0 13.5 2h-3zM10 3.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-2z"/>
    <path d="M2.5 9A1.5 1.5 0 0 0 1 10.5v2A1.5 1.5 0 0 0 2.5 14h3A1.5 1.5 0 0 0 7 12.5v-2A1.5 1.5 0 0 0 5.5 9h-3zM2 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-2z"/>
    <path d="M7 4.5h2v1H7zM4 7v2h1V7zM12 7v2h1V7zM7 11.5h2v1H7z"/>
    <path d="M10.5 9A1.5 1.5 0 0 0 9 10.5v2a1.5 1.5 0 0 0 1.5 1.5h3a1.5 1.5 0 0 0 1.5-1.5v-2A1.5 1.5 0 0 0 13.5 9h-3zm-.5 1.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-2z"/>
  </svg>
);

export const MessageCircleIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

export const GitHubIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
  </svg>
);


