import { Box } from '@mui/material';

export function TimeDisplay({ seconds }: { seconds: number }) {
  const hundredths = Math.max(0, Math.floor(seconds * 100));
  const wholeSeconds = Math.floor(hundredths / 100);
  const minutes = String(Math.floor(wholeSeconds / 60)).padStart(2, '0');
  const remainder = String(wholeSeconds % 60).padStart(2, '0');
  const fraction = String(hundredths % 100).padStart(2, '0');

  return (
    <>
      {minutes}
      :
      {remainder}
      <Box component="span" sx={{ fontSize: '50%' }}>
        .
        {fraction}
      </Box>
    </>
  );
}
