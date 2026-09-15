import { Box, FormControl, FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material';
import type { Ref } from 'react';
import { useLocale } from '../../../i18n/LocaleProvider';
import { isPreviewSize, type PreviewSize } from '../previewLayout';

export function PreviewSizePanel({
  panelRef,
  value,
  onChange,
}: {
  panelRef: Ref<HTMLDivElement>;
  value: PreviewSize;
  onChange: (size: PreviewSize) => void;
}) {
  const { copy } = useLocale();
  return (
    <Box
      ref={panelRef}
      sx={{
        position: 'absolute',
        right: 12,
        bottom: 12,
        zIndex: 3,
        minWidth: 132,
        bgcolor: 'rgba(26, 26, 26, 0.94)',
        border: '1px solid rgba(255,255,255,0.1)',
        px: 1.5,
        pt: 1,
        pb: 1,
        borderRadius: 1.5,
      }}
    >
      <FormControl>
        <Typography
          id="preview-size-label"
          sx={{
            display: 'block',
            mb: 0.75,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'text.secondary',
          }}
        >
          {copy.previewSize}
        </Typography>
        <RadioGroup
          name="preview-size"
          value={value}
          onChange={(_, next) => {
            if (isPreviewSize(next)) onChange(next);
          }}
          aria-labelledby="preview-size-label"
          sx={{ gap: 0.25 }}
        >
          <FormControlLabel
            value="large"
            control={<Radio size="small" />}
            label={copy.sizeLarge}
            sx={{
              m: 0,
              '& .MuiFormControlLabel-label': { fontSize: 13, lineHeight: 1.2 },
              '& .MuiRadio-root': { py: 0.35, pl: 0.25, pr: 0.75 },
            }}
          />
          <FormControlLabel
            value="small"
            control={<Radio size="small" />}
            label={copy.sizeSmall}
            sx={{
              m: 0,
              '& .MuiFormControlLabel-label': { fontSize: 13, lineHeight: 1.2 },
              '& .MuiRadio-root': { py: 0.35, pl: 0.25, pr: 0.75 },
            }}
          />
        </RadioGroup>
      </FormControl>
    </Box>
  );
}
