import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  cssBackgroundHex,
  normalizeBackgroundHex,
} from '../../../export/exportLook';
import { isMovOutputSize, type MovOutputSize } from '../../../export/movSize';
import { useLocale } from '../../../i18n/LocaleProvider';

export function ExportDialog({
  open,
  exporting,
  savePercent,
  movSize,
  backgroundHex,
  blurPx,
  onClose,
  onCancelExport,
  onConfirm,
  onMovSizeChange,
  onBackgroundHexChange,
  onBlurPxChange,
}: {
  open: boolean;
  exporting: boolean;
  savePercent: number;
  movSize: MovOutputSize;
  backgroundHex: string;
  blurPx: string;
  onClose: () => void;
  onCancelExport: () => void;
  onConfirm: () => void;
  onMovSizeChange: (size: MovOutputSize) => void;
  onBackgroundHexChange: (hex: string) => void;
  onBlurPxChange: (blurPx: string) => void;
}) {
  const { copy } = useLocale();
  const blur = Number(blurPx);
  const canConfirm = Boolean(normalizeBackgroundHex(backgroundHex))
    && Number.isFinite(blur)
    && blur >= 0;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={exporting ? 'processing-title' : 'export-size-title'}
    >
      {exporting
        ? (
            <>
              <DialogTitle id="processing-title">{copy.processing}</DialogTitle>
              <DialogContent sx={{ minWidth: 320 }}>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  {savePercent}
                  %
                </Typography>
                <LinearProgress variant="determinate" value={savePercent} />
              </DialogContent>
              <DialogActions>
                <Button onClick={onCancelExport}>{copy.cancel}</Button>
              </DialogActions>
            </>
          )
        : (
            <>
              <DialogTitle id="export-size-title">{copy.videoSize}</DialogTitle>
              <DialogContent>
                <Stack spacing={2} sx={{ minWidth: 320, pt: 0.5 }}>
                  <FormControl>
                    <RadioGroup
                      name="mov-output-size"
                      value={movSize}
                      onChange={(_, value) => {
                        if (isMovOutputSize(value)) onMovSizeChange(value);
                      }}
                    >
                      <FormControlLabel value="4k" control={<Radio />} label={copy.size4k} />
                      <FormControlLabel
                        value="1080p"
                        control={<Radio />}
                        label={copy.size1080p}
                      />
                      <FormControlLabel
                        value="native"
                        control={<Radio />}
                        label={copy.sizeNative}
                      />
                    </RadioGroup>
                  </FormControl>
                  <TextField
                    label={copy.videoBlur}
                    type="number"
                    value={blurPx}
                    onChange={(event) => onBlurPxChange(event.target.value)}
                    slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                  />
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <TextField
                      label={copy.videoBackground}
                      value={backgroundHex}
                      onChange={(event) => {
                        onBackgroundHexChange(
                          event.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6),
                        );
                      }}
                      slotProps={{
                        htmlInput: {
                          maxLength: 6,
                          spellCheck: false,
                          inputMode: 'text',
                        },
                      }}
                      sx={{ flex: 1 }}
                    />
                    <Box
                      component="input"
                      type="color"
                      aria-label={copy.videoBackgroundPicker}
                      value={cssBackgroundHex(backgroundHex)}
                      onChange={(event) => {
                        const hex = normalizeBackgroundHex(event.target.value);
                        if (hex) onBackgroundHexChange(hex);
                      }}
                      sx={{
                        width: 48,
                        height: 40,
                        p: 0,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'transparent',
                        cursor: 'pointer',
                      }}
                    />
                  </Stack>
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={onClose}>{copy.cancel}</Button>
                <Button variant="contained" onClick={onConfirm} disabled={!canConfirm}>
                  {copy.saveMov}
                </Button>
              </DialogActions>
            </>
          )}
    </Dialog>
  );
}
