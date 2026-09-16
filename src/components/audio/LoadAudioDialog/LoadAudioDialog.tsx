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
import { useState, type FormEvent } from 'react';
import { isHttpUrl } from '../../../audio/fetchAudioFile';
import { useLocale } from '../../../i18n/LocaleProvider';

type AudioSource = 'local' | 'web';

export function LoadAudioDialog({
  open,
  onClose,
  onChooseLocal,
  onChooseWeb,
}: {
  open: boolean;
  onClose: () => void;
  onChooseLocal: () => void;
  onChooseWeb: (url: string) => void;
}) {
  const { copy } = useLocale();
  const [source, setSource] = useState<AudioSource>('local');
  const [url, setUrl] = useState('');

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
    <Dialog open={open} onClose={handleClose} aria-labelledby="load-audio-title">
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
