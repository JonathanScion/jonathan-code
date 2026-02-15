import { Box, Typography, Button, Breadcrumbs, Link as MuiLink } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { Link } from 'react-router-dom';

interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: Crumb[];
  onAdd?: () => void;
  addLabel?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, breadcrumbs, onAdd, addLabel = 'Add New', action }: PageHeaderProps) {
  return (
    <Box sx={{ mb: 3 }}>
      {breadcrumbs && (
        <Breadcrumbs sx={{ mb: 1 }}>
          {breadcrumbs.map((crumb, i) =>
            crumb.to ? (
              <MuiLink key={i} component={Link} to={crumb.to} underline="hover" color="inherit">
                {crumb.label}
              </MuiLink>
            ) : (
              <Typography key={i} color="text.primary">{crumb.label}</Typography>
            )
          )}
        </Breadcrumbs>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">{title}</Typography>
        {action || (onAdd && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>
            {addLabel}
          </Button>
        ))}
      </Box>
    </Box>
  );
}
