import {
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
  Typography,
} from '@mui/material';
import { isMovOutputSize, type MovOutputSize } from '../../../export/movSize';
import { useLocale } from '../../../i18n/LocaleProvider';

export function ExportDialog({
  open,
  exporting,
  savePercent,
  movSize,
  onClose,
  onCancelExport,
  onConfirm,
  onMovSizeChange,
}: {
  open: boolean;
  exporting: boolean;
  savePercent: number;
  movSize: MovOutputSize;
  onClose: () => void;
  onCancelExport: () => void;
  onConfirm: () => void;
  onMovSizeChange: (size: MovOutputSize) => void;
}) {
  const { copy } = useLocale();
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
              </DialogContent>
              <DialogActions>
                <Button onClick={onClose}>{copy.cancel}</Button>
                <Button variant="contained" onClick={onConfirm}>{copy.saveMov}</Button>
              </DialogActions>
            </>
          )}
    </Dialog>
  );
}
