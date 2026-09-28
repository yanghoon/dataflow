import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Select, MenuItem, InputLabel, FormControl } from '@material-ui/core';
import { SettingItem, SettingType } from '../../api/types';

interface AddSettingDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: SettingItem) => Promise<void>;
}

export const AddSettingDialog = ({ open, onClose, onSave }: AddSettingDialogProps) => {
  const [key, setKey] = useState('');
  const [type, setType] = useState<SettingType>('STRING');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [group, setGroup] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    let parsedValue: any = value;
    if (type === 'BOOLEAN') {
      parsedValue = value.toLowerCase() === 'true';
    } else if (type === 'NUMBER') {
      parsedValue = Number(value);
    }
    
    await onSave({
      key,
      type,
      label,
      description,
      value: parsedValue,
      group
    });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add New Config</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Key (e.g. test.my.setting)"
          fullWidth
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <FormControl fullWidth margin="dense">
          <InputLabel>Type</InputLabel>
          <Select value={type} onChange={(e) => setType(e.target.value as SettingType)}>
            <MenuItem value="STRING">String</MenuItem>
            <MenuItem value="NUMBER">Number</MenuItem>
            <MenuItem value="BOOLEAN">Boolean</MenuItem>
            <MenuItem value="SELECT">Select</MenuItem>
          </Select>
        </FormControl>
        <TextField
          margin="dense"
          label="Label"
          fullWidth
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <TextField
          margin="dense"
          label="Description"
          fullWidth
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TextField
          margin="dense"
          label="Initial Value"
          fullWidth
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <TextField
          margin="dense"
          label="Group (optional)"
          fullWidth
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained" disabled={saving || !key || !label}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
