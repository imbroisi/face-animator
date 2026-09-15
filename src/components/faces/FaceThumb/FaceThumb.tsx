import { Box } from '@mui/material';

export function FaceThumb({ mouth, eye }: { mouth: string; eye: string }) {
  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Box
        component="img"
        src={mouth}
        alt=""
        draggable={false}
        sx={{
          position: 'absolute',
          inset: 0,
          m: 'auto',
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
        }}
      />
      {eye && (
        <Box
          component="img"
          src={eye}
          alt=""
          draggable={false}
          sx={{
            position: 'absolute',
            inset: 0,
            m: 'auto',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      )}
    </Box>
  );
}
