import { useId } from 'react';
import { TextField, type TextFieldProps } from '@mui/material';

/** A consistently labeled field; MUI links the helper/error text through aria-describedby. */
export function FormField({
  validationMessage,
  ...props
}: TextFieldProps & { validationMessage?: string }) {
  const id = useId();
  return (
    <TextField
      {...props}
      id={props.id ?? id}
      fullWidth
      error={Boolean(validationMessage) || props.error}
      helperText={validationMessage ?? props.helperText}
    />
  );
}
