import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import { faceNames, isFaceType, type FaceType } from '../../../faces/Faces';
import { useLocale } from '../../../i18n/LocaleProvider';

export function FaceSetPicker({
  face,
  faceLevel,
  previewFace,
  onFaceChange,
  onNextMouth,
}: {
  face: FaceType;
  faceLevel: number;
  previewFace: FaceType;
  onFaceChange: (face: FaceType) => void;
  onNextMouth: () => void;
}) {
  const { copy } = useLocale();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography aria-label={copy.imageName}>{faceNames[previewFace][faceLevel]}</Typography>
        <Button
          variant="outlined"
          aria-label={copy.nextImage}
          sx={{ minWidth: 40 }}
          onClick={onNextMouth}
        >
          +
        </Button>
      </Box>
      <FormControl component="fieldset">
        <RadioGroup
          row
          name="face-set"
          value={face}
          onChange={(_, value) => {
            if (isFaceType(value)) onFaceChange(value);
          }}
          aria-label={copy.faceSet}
        >
          <FormControlLabel
            value="normal"
            control={<Radio size="small" />}
            label={copy.faces.normal}
          />
          <FormControlLabel
            value="upset"
            control={<Radio size="small" />}
            label={copy.faces.upset}
          />
          <FormControlLabel
            value="sad"
            control={<Radio size="small" />}
            label={copy.faces.sad}
          />
          <FormControlLabel
            value="suspicious"
            control={<Radio size="small" />}
            label={copy.faces.suspicious}
          />
        </RadioGroup>
      </FormControl>
    </Box>
  );
}
