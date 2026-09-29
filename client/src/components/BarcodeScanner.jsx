import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from 'html5-qrcode';

/**
 * Web Audio API synthesizer for cashier scanner feedback beeps.
 * Zero external audio files or dependencies.
 */
function playScannerBeep(type = 'success') {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      // Crisp 880Hz POS confirmation tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } else {
      // Lower warning buzzer tone
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    }
  } catch {
    // Silently ignore audio autoplay restrictions
  }
}

/**
 * Reusable Camera Barcode Scanner Component
 * Supports Code 128, EAN, UPC and other standard 1D/2D barcodes locally in-browser.
 * Handles device enumeration, rear camera prioritization, permission requests,
 * duplicate scan cooldown, torch control, and complete resource disposal.
 */
export default function BarcodeScanner({
  isOpen = false,
  onClose,
  onScan,
  statusMessage = null,
  isProcessing = false,
}) {
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [permissionError, setPermissionError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isScanningActive, setIsScanningActive] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [flashSuccess, setFlashSuccess] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState('');

  const scannerRef = useRef(null);
  const scannerContainerId = 'shopflow-camera-barcode-reader';
  const isMountedRef = useRef(true);

  // Cooldown tracking refs
  const SAME_BARCODE_COOLDOWN_MS = 2000;
  const DIFFERENT_BARCODE_COOLDOWN_MS = 750;
  const lastScanTimestampRef = useRef({ code: '', time: 0 });
  const internalProcessingRef = useRef(false);

  /**
   * Complete, safe resource cleanup for camera streams and scanner instances.
   * Releases hardware camera access immediately so the indicator light turns off.
   */
  const stopAndCleanScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('[BarcodeScanner] Error while stopping scanner:', err?.message || err);
      }
      scannerRef.current = null;
    }

    // Secondary safety: forcibly stop any active MediaStream tracks on video elements
    const container = document.getElementById(scannerContainerId);
    if (container) {
      const videos = container.querySelectorAll('video');
      videos.forEach((video) => {
        if (video.srcObject && typeof video.srcObject.getTracks === 'function') {
          video.srcObject.getTracks().forEach((track) => track.stop());
          video.srcObject = null;
        }
      });
    }

    if (isMountedRef.current) {
      setIsScanningActive(false);
      setTorchSupported(false);
      setTorchOn(false);
    }
  }, [scannerContainerId]);

  /**
   * Barcode detection handler with duplicate cooldown & audio-visual confirmation.
   */
  const handleDecodedBarcode = useCallback(
    async (decodedText) => {
      const barcode = String(decodedText || '').trim();
      if (!barcode) return;

      // Avoid parallel lookups while one is in progress
      if (internalProcessingRef.current || isProcessing) {
        return;
      }

      const now = Date.now();
      const last = lastScanTimestampRef.current;
      const isSameBarcode = last.code === barcode;
      const elapsed = now - last.time;

      // Enforce cooldown windows
      if (isSameBarcode && elapsed < SAME_BARCODE_COOLDOWN_MS) {
        return;
      }
      if (!isSameBarcode && elapsed < DIFFERENT_BARCODE_COOLDOWN_MS) {
        return;
      }

      lastScanTimestampRef.current = { code: barcode, time: now };
      internalProcessingRef.current = true;

      // Visual flash on reticle
      setLastScannedCode(barcode);
      setFlashSuccess(true);
      setTimeout(() => {
        if (isMountedRef.current) setFlashSuccess(false);
      }, 500);

      try {
        if (typeof onScan === 'function') {
          const result = await onScan(barcode);
          if (result && result.success === false) {
            playScannerBeep('error');
          } else {
            playScannerBeep('success');
          }
        }
      } catch {
        playScannerBeep('error');
      } finally {
        internalProcessingRef.current = false;
      }
    },
    [onScan, isProcessing]
  );

  /**
   * Start camera scanner with specified camera configuration.
   */
  const startCameraScanner = useCallback(
    async (cameraDeviceOrFacing) => {
      if (!isOpen) return;

      setIsInitializing(true);
      setPermissionError(null);

      // Verify browser support and secure context
      const isLocalhost = Boolean(
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '[::1]'
      );
      if (!window.isSecureContext && !isLocalhost) {
        setPermissionError({
          type: 'insecure',
          message: 'Camera access requires a secure HTTPS connection. Please access this POS via HTTPS.',
        });
        setIsInitializing(false);
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionError({
          type: 'unsupported',
          message: 'Camera video streaming is not supported on this browser or platform.',
        });
        setIsInitializing(false);
        return;
      }

      try {
        // Stop any running instance before starting
        await stopAndCleanScanner();

        // Check if the container element is ready in DOM
        const container = document.getElementById(scannerContainerId);
        if (!container) {
          setIsInitializing(false);
          return;
        }

        // Configure scanner to prioritize Code 128 (ShopFlow format) and standard retail barcodes
        const html5QrCode = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
          useBarCodeDetectorIfSupported: true,
        });

        scannerRef.current = html5QrCode;

        // Viewfinder configuration optimized for 1D horizontal retail barcodes
        const scanConfig = {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.min(Math.floor(viewfinderWidth * 0.85), 450);
            const height = Math.min(Math.floor(viewfinderHeight * 0.45), 180);
            return {
              width: Math.max(width, 240),
              height: Math.max(height, 120),
            };
          },
          aspectRatio: 1.333333,
        };

        // Determine camera target (specific deviceId or environment facingMode)
        let cameraConfig = cameraDeviceOrFacing;
        if (!cameraConfig) {
          cameraConfig = { facingMode: 'environment' };
        }

        await html5QrCode.start(
          cameraConfig,
          scanConfig,
          handleDecodedBarcode,
          () => {
            // Per-frame non-match callback (silent)
          }
        );

        if (!isMountedRef.current) {
          await stopAndCleanScanner();
          return;
        }

        setIsScanningActive(true);
        setIsInitializing(false);

        // Check torch capabilities
        try {
          const capabilities = html5QrCode.getRunningTrackCapabilities();
          if (capabilities && 'torch' in capabilities) {
            setTorchSupported(true);
          }
        } catch {
          setTorchSupported(false);
        }

        // Enumerate cameras if not already populated
        try {
          const devices = await Html5Qrcode.getCameras();
          if (isMountedRef.current && devices && devices.length > 0) {
            setCameras(devices);
            // If started with facingMode, match active camera device if possible
            if (typeof cameraConfig === 'string') {
              setSelectedCameraId(cameraConfig);
            } else {
              const rearMatch = devices.find((d) =>
                /back|rear|environment/i.test(d.label || '')
              );
              setSelectedCameraId(rearMatch ? rearMatch.id : devices[0].id);
            }
          }
        } catch {
          // Camera list enumeration non-fatal
        }
      } catch (err) {
        console.error('[BarcodeScanner] Start failed:', err);
        if (!isMountedRef.current) return;

        setIsInitializing(false);
        setIsScanningActive(false);

        const errMsg = String(err?.message || err?.name || err);
        if (
          err?.name === 'NotAllowedError' ||
          errMsg.includes('Permission') ||
          errMsg.includes('NotAllowedError') ||
          errMsg.includes('denied')
        ) {
          setPermissionError({
            type: 'permission',
            message: 'Camera permission is required to scan barcodes.',
          });
        } else if (
          err?.name === 'NotFoundError' ||
          errMsg.includes('NotFoundError') ||
          errMsg.includes('No cameras')
        ) {
          setPermissionError({
            type: 'not_found',
            message: 'No available camera found on this device.',
          });
        } else if (
          err?.name === 'NotReadableError' ||
          errMsg.includes('in use') ||
          errMsg.includes('NotReadableError')
        ) {
          setPermissionError({
            type: 'in_use',
            message: 'Camera is currently in use by another application or tab.',
          });
        } else {
          setPermissionError({
            type: 'general',
            message: err?.message || 'Could not start camera scanner. Please check permissions.',
          });
        }
      }
    },
    [isOpen, stopAndCleanScanner, handleDecodedBarcode]
  );

  /**
   * Handle switching camera from dropdown
   */
  const handleCameraChange = async (e) => {
    const newId = e.target.value;
    setSelectedCameraId(newId);
    if (newId) {
      await startCameraScanner(newId);
    }
  };

  /**
   * Toggle flashlight/torch on mobile if supported
   */
  const handleToggleTorch = async () => {
    if (!scannerRef.current || !torchSupported) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn('[BarcodeScanner] Torch toggle error:', err);
    }
  };

  /**
   * Setup lifecycle on mount/open/close
   */
  useEffect(() => {
    isMountedRef.current = true;

    if (isOpen) {
      // Start scanner with rear camera preference
      startCameraScanner({ facingMode: 'environment' });
    } else {
      stopAndCleanScanner();
    }

    // Keyboard ESC shortcut listener
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('keydown', handleKeyDown);
      stopAndCleanScanner();
    };
  }, [isOpen, startCameraScanner, stopAndCleanScanner, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="modal-backdrop scanner-modal-backdrop no-print"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-modal-title"
    >
      <div
        className="scanner-modal-card"
        style={{
          background: 'var(--bg-secondary, #111726)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 'var(--radius-lg, 16px)',
          padding: '1.25rem',
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(99, 102, 241, 0.25)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            paddingBottom: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.25rem' }} role="img" aria-label="camera">
              📷
            </span>
            <div>
              <h3
                id="scanner-modal-title"
                style={{
                  margin: 0,
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: 'var(--text-primary, #f8fafc)',
                }}
              >
                Scan Product Barcode
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                Code 128 • EAN • UPC retail formats
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            aria-label="Close Scanner"
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '1rem',
              lineHeight: 1,
              borderRadius: 'var(--radius-sm, 8px)',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
              color: 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Toolbar: Camera switch & Torch */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          {cameras.length > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: '180px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Camera:</span>
              <select
                value={selectedCameraId}
                onChange={handleCameraChange}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  padding: '4px 8px',
                }}
              >
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label || `Camera ${cam.id.slice(0, 5)}...`}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              ⚡ Continuous scanner active
            </div>
          )}

          {torchSupported && (
            <button
              type="button"
              onClick={handleToggleTorch}
              className="btn btn-secondary"
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem',
                background: torchOn ? 'rgba(234, 179, 8, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                borderColor: torchOn ? '#eab308' : 'var(--border-subtle)',
                color: torchOn ? '#fef08a' : 'var(--text-secondary)',
              }}
            >
              {torchOn ? '🔦 Flash ON' : '🔦 Flash OFF'}
            </button>
          )}
        </div>

        {/* Camera Viewport & Scanning Region */}
        <div
          className="barcode-scanner-viewport"
          style={{
            position: 'relative',
            width: '100%',
            height: '280px',
            borderRadius: 'var(--radius-md, 12px)',
            overflow: 'hidden',
            background: '#090d16',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* html5-qrcode target container */}
          <div
            id={scannerContainerId}
            style={{
              width: '100%',
              height: '100%',
              display: isScanningActive ? 'block' : 'none',
            }}
          />

          {/* Loading state indicator */}
          {isInitializing && (
            <div
              style={{
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid rgba(99, 102, 241, 0.3)',
                  borderTopColor: 'var(--accent-primary, #6366f1)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span>Initializing camera...</span>
            </div>
          )}

          {/* Permission or Camera Error View */}
          {permissionError && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem',
                textAlign: 'center',
                background: 'rgba(15, 23, 42, 0.95)',
                color: 'var(--text-primary)',
                gap: '0.75rem',
              }}
            >
              <span style={{ fontSize: '2rem' }}>⚠️</span>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#ef4444' }}>
                {permissionError.message}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '320px' }}>
                Please ensure your browser has permission to access your webcam or camera.
              </div>
              <button
                type="button"
                onClick={() => startCameraScanner(selectedCameraId || { facingMode: 'environment' })}
                className="btn btn-primary"
                style={{ marginTop: '0.5rem', padding: '0.45rem 1.25rem', fontSize: '0.85rem' }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Live Scanner Aiming Reticle Overlay */}
          {isScanningActive && !permissionError && (
            <div
              className="scanner-reticle-container"
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                className={`scanner-reticle-box ${flashSuccess ? 'scanned-success' : ''}`}
                style={{
                  position: 'relative',
                  width: '84%',
                  maxWidth: '380px',
                  height: '140px',
                  border: flashSuccess ? '2px solid #10b981' : '2px solid rgba(99, 102, 241, 0.6)',
                  borderRadius: '12px',
                  boxShadow: flashSuccess
                    ? '0 0 0 9999px rgba(0, 0, 0, 0.4), 0 0 25px rgba(16, 185, 129, 0.8)'
                    : '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                  transition: 'all 0.2s ease',
                  overflow: 'hidden',
                }}
              >
                {/* Corner markers */}
                <span className="scanner-reticle-corner tl" />
                <span className="scanner-reticle-corner tr" />
                <span className="scanner-reticle-corner bl" />
                <span className="scanner-reticle-corner br" />

                {/* Animated laser scanning line */}
                {!flashSuccess && <div className="scanner-laser-line" />}

                {/* Flash confirmation center text */}
                {flashSuccess && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(16, 185, 129, 0.25)',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '1rem',
                      letterSpacing: '0.05em',
                      animation: 'fadeIn 0.15s ease',
                    }}
                  >
                    ✓ SCANNED
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Guidance Prompt & Last Detected Barcode */}
        <div
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary, #94a3b8)',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          Point camera at the barcode. Items are added automatically.
          {lastScannedCode && (
            <div
              style={{
                marginTop: '0.25rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted, #64748b)',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              Last decoded: <strong style={{ color: '#38bdf8' }}>{lastScannedCode}</strong>
            </div>
          )}
        </div>

        {/* Live Feedback Banner inside the Modal */}
        {statusMessage && (
          <div
            style={{
              padding: '0.65rem 0.9rem',
              borderRadius: 'var(--radius-sm, 8px)',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background:
                statusMessage.type === 'success'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : statusMessage.type === 'warning'
                  ? 'rgba(234, 179, 8, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
              color:
                statusMessage.type === 'success'
                  ? '#10b981'
                  : statusMessage.type === 'warning'
                  ? '#fbbf24'
                  : '#ef4444',
              border: `1px solid ${
                statusMessage.type === 'success'
                  ? 'rgba(16, 185, 129, 0.3)'
                  : statusMessage.type === 'warning'
                  ? 'rgba(234, 179, 8, 0.3)'
                  : 'rgba(239, 68, 68, 0.3)'
              }`,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <span>
              {statusMessage.type === 'success' ? '✓' : statusMessage.type === 'warning' ? '⚠️' : '✕'}
            </span>
            <span style={{ flex: 1 }}>{statusMessage.text}</span>
          </div>
        )}

        {/* Action Button: Close Scanner */}
        <button
          type="button"
          onClick={onClose}
          className="btn btn-secondary"
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            justifyContent: 'center',
            borderRadius: 'var(--radius-sm, 8px)',
            cursor: 'pointer',
          }}
        >
          ✕ Close Scanner
        </button>
      </div>
    </div>
  );
}
