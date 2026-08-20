/**
 * File picker button that opens the native file-selection dialog. Accepts
 * any file: supported raster images admit as image attachments while every
 * other file becomes a metadata-only reference (the composer's intake
 * pre-check routes each file).
 */
import { useCallback, useRef } from 'react'
import css from './FilePickerButton.module.css'

export interface FilePickerButtonProps {
  /** Whether the button is disabled (e.g., attachments cannot be added now). */
  disabled: boolean
  /** Callback when files are selected. */
  onFilesSelected: (files: File[]) => void
  /** Button label text. */
  label: string
  /** Optional tooltip text. */
  tooltip?: string
}

export function FilePickerButton({
  disabled,
  onFilesSelected,
  label,
  tooltip,
}: FilePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = useCallback(() => {
    if (disabled) return
    inputRef.current?.click()
  }, [disabled])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files === null || files.length === 0) return

    onFilesSelected(Array.from(files))

    // Reset input value so the same file can be selected again
    if (inputRef.current !== null) {
      inputRef.current.value = ''
    }
  }, [onFilesSelected])

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleChange}
        className={css.hiddenInput}
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        className={css.button}
        onClick={handleClick}
        disabled={disabled}
        aria-label={tooltip ?? label}
        title={tooltip ?? label}
      >
        <svg className={css.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className={css.label}>{label}</span>
      </button>
    </>
  )
}
