import './UploadStatus.css'

export default function UploadStatus({ progress, statusText = 'Uploading to TEE…', showProgressBar = true }) {
  return (
    <div className="upload-status">
      <div className="upload-status-spinner" aria-hidden />
      <p className="upload-status-text">{statusText}</p>
      {showProgressBar && (
        <>
          <div className="upload-status-bar">
            <div
              className="upload-status-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="upload-status-percent">{Math.round(progress)}%</p>
        </>
      )}
    </div>
  )
}
