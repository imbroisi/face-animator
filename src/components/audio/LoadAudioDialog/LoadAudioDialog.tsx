import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { isHttpUrl } from '../../../audio/fetchAudioFile';
import { useLocale } from '../../../i18n/LocaleProvider';

type AudioSource = 'local' | 'web';

export function LoadAudioDialog({
  open,
  initialWebUrl,
  onClose,
  onChooseLocal,
  onChooseWeb,
  onUrlField,
}: {
  open: boolean;
  initialWebUrl?: string;
  onClose: () => void;
  onChooseLocal: () => void;
  onChooseWeb: (url: string) => void;
  onUrlField?: (el: HTMLElement | null) => void;
}) {
  const { copy } = useLocale();
  const urlInput = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<AudioSource>(initialWebUrl ? 'web' : 'local');
  const [url, setUrl] = useState(initialWebUrl ?? '');

  useLayoutEffect(() => {
    if (!onUrlField) return;
    if (!open || source !== 'web') onUrlField(null);
  }, [open, source, onUrlField]);

  function reportUrlField() {
    if (open && source === 'web') onUrlField?.(urlInput.current);
  }

  const webUrl = url.trim();
  const canConfirm = source === 'local' || isHttpUrl(webUrl);

  function reset() {
    setSource('local');
    setUrl('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (source === 'local') {
      onChooseLocal();
      return;
    }
    if (!isHttpUrl(webUrl)) return;
    onChooseWeb(webUrl);
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="load-audio-title"
      slotProps={{
        transition: {
          onEntered: reportUrlField,
          onExited: () => onUrlField?.(null),
        },
      }}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle id="load-audio-title">{copy.loadAudio}</DialogTitle>
        <DialogContent sx={{ minWidth: 320 }}>
          <FormControl>
            <RadioGroup
              name="audio-source"
              aria-label={copy.loadAudioSource}
              value={source}
              onChange={(_, value) => {
                if (value === 'local' || value === 'web') setSource(value);
              }}
            >
              <FormControlLabel
                value="local"
                control={<Radio />}
                label={copy.loadAudioLocal}
              />
              <FormControlLabel
                value="web"
                control={<Radio />}
                label={copy.loadAudioWeb}
              />
            </RadioGroup>
          </FormControl>
          {source === 'web' && (
            <>
              <TextField
                autoFocus
                fullWidth
                margin="normal"
                type="url"
                name="audio-url"
                label={copy.loadAudioUrl}
                placeholder="https://"
                value={url}
                inputRef={urlInput}
                onChange={(event) => setUrl(event.target.value)}
              />
              <Typography variant="body2" color="text.secondary">
                {copy.loadAudioUrlHint}
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleClose}>{copy.cancel}</Button>
          <Button type="submit" variant="contained" disabled={!canConfirm}>
            {source === 'local' ? copy.chooseAudioFile : copy.loadAudio}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
