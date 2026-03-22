import './FilePreview.css'

export default function FilePreview({ fileName, preview }) {
  const { header, rows } = preview
  const headerCells = header.split('\t')

  return (
    <div className="file-preview">
      <p className="file-preview-name">{fileName}</p>
      <div className="file-preview-table-wrap">
        <table className="file-preview-table">
          <thead>
            <tr>
              {headerCells.map((cell, i) => (
                <th key={i}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={j === 2 ? 'file-preview-cell--blur' : ''}
                    title={j === 2 ? 'Speaker name hidden for privacy' : undefined}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="file-preview-hint">Speaker names are hidden for privacy.</p>
    </div>
  )
}
