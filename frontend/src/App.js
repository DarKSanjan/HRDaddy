import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import EmployeeDirectory from './EmployeeDirectory';

// Import icons for the new menu structure
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupIcon from '@mui/icons-material/Group';
import WorkIcon from '@mui/icons-material/Work';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventNoteIcon from '@mui/icons-material/EventNote';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

// Animated Icon Component
function AnimatedIcon({ icon: Icon, onClick, isSelected = false, children }) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
    if (onClick) onClick();
  };

  return (
    <Box
      onClick={handleClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isAnimating ? 'scale(0.9)' : 'scale(1)',
        '&:hover': {
          transform: 'scale(1.1)',
          filter: 'drop-shadow(0 0 8px rgba(27, 209, 254, 0.6))',
        },
        '&:active': {
          transform: 'scale(0.95)',
        }
      }}
    >
      {children || <Icon />}
    </Box>
  );
}

// Create a dark theme with cyan as primary and violet purple as accent
const darkTheme = createTheme({
  typography: {
    fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    h2: {
      fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    h3: {
      fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    h4: {
      fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    h5: {
      fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    h6: {
      fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    body1: {
      fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    body2: {
      fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif',
    },
  },
  palette: {
    mode: 'dark',
    background: {
      default: '#0f0f0f', // Better dark background
      paper: '#1a1a1a',   // Dark sidebar background
    },
    primary: {
      main: '#1bd1fe', // Cyan as primary
    },
    secondary: {
      main: '#8920fe', // Violet purple as accent
    },
    text: {
      primary: '#ffffff',
      secondary: '#a1a1aa',
    },
  },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: '#0a0a0a', // Very dark sidebar
          borderRight: '1px solid #1a1a1a',
          borderRadius: '0 16px 16px 0', // Rounded corners on right side
          margin: '8px 0 8px 8px', // Add margin for rounded corners
          height: 'calc(100vh - 16px)', // Adjust height for margins
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          margin: '2px 8px',
          borderRadius: '12px',
          '&:hover': {
            backgroundColor: 'rgba(27, 209, 254, 0.1)', // Cyan hover
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(27, 209, 254, 0.2)', // Cyan selected
            borderLeft: '3px solid #1bd1fe',
            '&:hover': {
              backgroundColor: 'rgba(27, 209, 254, 0.25)',
            },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderRadius: '16px 0 0 16px', // Rounded corners on left side
          margin: '8px 8px 8px 0', // Add margin for rounded corners
          width: 'calc(100% - 8px)', // Adjust width for margins
        },
      },
    },
  },
});

const drawerWidth = 280;

// Logo component with the actual HRDaddy logo image - now clickable
function Logo() {
  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      py: 3,
      borderBottom: '1px solid #1a1a1a'
    }}>
      <Link to="/" style={{ textDecoration: 'none' }}>
        <Box sx={{
          cursor: 'pointer',
          transition: 'transform 0.2s ease-in-out',
          '&:hover': {
            transform: 'scale(1.05)',
          }
        }}>
          <img 
            src="/hrdaddy-logo-horizontal.png" 
            alt="HRDaddy Logo" 
            style={{ 
              height: '40px',
              width: 'auto',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
            }}
          />
        </Box>
      </Link>
    </Box>
  );
}

// Category component for collapsible menu sections
function MenuCategory({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const location = useLocation();
  
  // Auto-expand category if current route is within this category
  React.useEffect(() => {
    const currentPath = location.pathname;
    const categoryPaths = children.map(child => child.path);
    if (categoryPaths.some(path => currentPath.startsWith(path))) {
      setOpen(true);
    }
  }, [location.pathname, children]);

  return (
    <>
      <ListItem 
        button 
        onClick={() => setOpen(!open)}
        sx={{ 
          py: 1.5,
          '&:hover': {
            backgroundColor: 'rgba(27, 209, 254, 0.05)', // Cyan hover
          }
        }}
      >
        <ListItemIcon sx={{ color: '#a1a1aa', minWidth: 40 }}>
          <AnimatedIcon icon={icon.type} onClick={() => setOpen(!open)}>
            {React.cloneElement(icon, {
              sx: { 
                transition: 'transform 0.3s ease',
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)'
              }
            })}
          </AnimatedIcon>
        </ListItemIcon>
        <ListItemText 
          primary={title} 
          primaryTypographyProps={{ 
            fontSize: '0.9rem',
            fontWeight: 500,
            color: '#a1a1aa',
            fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif'
          }}
        />
        {open ? <ExpandLess sx={{ color: '#a1a1aa' }} /> : <ExpandMore sx={{ color: '#a1a1aa' }} />}
      </ListItem>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          {children.map((item) => (
            <ListItem
              key={item.path}
              button
              component={Link}
              to={item.path}
              sx={{
                pl: 4,
                py: 1,
                margin: '2px 8px',
                borderRadius: '12px',
                '&.Mui-selected': {
                  backgroundColor: 'rgba(27, 209, 254, 0.15)', // Cyan selected
                  borderLeft: '2px solid #1bd1fe',
                },
                '&:hover': {
                  backgroundColor: 'rgba(27, 209, 254, 0.08)', // Cyan hover
                }
              }}
            >
              <ListItemIcon sx={{ color: '#d1d5db', minWidth: 36 }}>
                <AnimatedIcon icon={item.icon.type}>
                  {item.icon}
                </AnimatedIcon>
              </ListItemIcon>
              <ListItemText 
                primary={item.title} 
                primaryTypographyProps={{ 
                  fontSize: '0.85rem',
                  color: '#d1d5db',
                  fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif'
                }}
              />
            </ListItem>
          ))}
        </List>
      </Collapse>
    </>
  );
}

// Simple Dashboard component
function Dashboard() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: 'white', mb: 3, fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
        Welcome to HRDaddy Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
        Manage your employees, track time and leave, and handle payroll all in one place.
      </Typography>
    </Box>
  );
}

// Placeholder components for new routes
function Roles() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: 'white', mb: 3, fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
        Roles Management
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
        Manage employee roles and permissions.
      </Typography>
    </Box>
  );
}

function Attendance() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: 'white', mb: 3, fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
        Attendance Tracking
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
        Track employee attendance and time records.
      </Typography>
    </Box>
  );
}

function LeaveRequests() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: 'white', mb: 3, fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
        Leave Requests
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
        Manage employee leave requests and approvals.
      </Typography>
    </Box>
  );
}

function ConfirmPayment() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: 'white', mb: 3, fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
        Confirm Payment
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
        Review and confirm employee payments.
      </Typography>
    </Box>
  );
}

function Payslips() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: 'white', mb: 3, fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
        Payslips
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
        Generate and manage employee payslips.
      </Typography>
    </Box>
  );
}

function App() {
  const location = useLocation();

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', bgcolor: 'background.default', minHeight: '100vh' }}>
        {/* Sidebar */}
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
        >
          <Logo />
          <Box sx={{ overflow: 'auto', mt: 2 }}>
            <List>
              {/* Dashboard */}
              <ListItem 
                button 
                component={Link} 
                to="/" 
                selected={location.pathname === '/'}
                sx={{ 
                  py: 1.5,
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(27, 209, 254, 0.15)', // Cyan selected
                    borderLeft: '3px solid #1bd1fe',
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(27, 209, 254, 0.08)', // Cyan hover
                  }
                }}
              >
                <ListItemIcon sx={{ color: '#d1d5db', minWidth: 40 }}>
                  <AnimatedIcon icon={DashboardIcon} isSelected={location.pathname === '/'}>
                    <DashboardIcon />
                  </AnimatedIcon>
                </ListItemIcon>
                <ListItemText 
                  primary="Dashboard" 
                  primaryTypographyProps={{ 
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    color: '#d1d5db',
                    fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif'
                  }}
                />
              </ListItem>

              <Divider sx={{ my: 2, borderColor: '#1a1a1a', mx: 2 }} />

              {/* Directory Category */}
              <MenuCategory 
                title="Directory" 
                icon={<GroupIcon />}
                defaultOpen={location.pathname.startsWith('/employees') || location.pathname.startsWith('/roles')}
              >
                {[
                  { path: '/employees', title: 'Employees', icon: <GroupIcon /> },
                  { path: '/roles', title: 'Roles', icon: <WorkIcon /> }
                ]}
              </MenuCategory>

              {/* Time and Leave Category */}
              <MenuCategory 
                title="Time & Leave" 
                icon={<AccessTimeIcon />}
                defaultOpen={location.pathname.startsWith('/attendance') || location.pathname.startsWith('/leave')}
              >
                {[
                  { path: '/attendance', title: 'Attendance', icon: <AccessTimeIcon /> },
                  { path: '/leave-requests', title: 'Leave Requests', icon: <EventNoteIcon /> }
                ]}
              </MenuCategory>

              {/* Payroll and Finance Category */}
              <MenuCategory 
                title="Payroll & Finance" 
                icon={<AttachMoneyIcon />}
                defaultOpen={location.pathname.startsWith('/payment') || location.pathname.startsWith('/payslips')}
              >
                {[
                  { path: '/confirm-payment', title: 'Confirm Payment', icon: <AttachMoneyIcon /> },
                  { path: '/payslips', title: 'Payslips', icon: <ReceiptIcon /> }
                ]}
              </MenuCategory>
            </List>
          </Box>
        </Drawer>

        {/* Main content area */}
        <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default', minHeight: '100vh' }}>
          {/* Top App Bar */}
          <AppBar 
            position="static" 
            sx={{ 
              zIndex: (theme) => theme.zIndex.drawer + 1,
              background: '#0a0a0a', // Very dark background
              borderBottom: '1px solid #1a1a1a',
              boxShadow: 'none'
            }}
          >
            <Toolbar sx={{ justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AnimatedIcon icon={SearchIcon}>
                  <SearchIcon sx={{ color: '#a1a1aa', mr: 2 }} />
                </AnimatedIcon>
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 500, fontFamily: '"Sora", "Roboto", "Helvetica", "Arial", sans-serif' }}>
                  {location.pathname === '/' && 'Dashboard'}
                  {location.pathname === '/employees' && 'Employees'}
                  {location.pathname === '/roles' && 'Roles'}
                  {location.pathname === '/attendance' && 'Attendance'}
                  {location.pathname === '/leave-requests' && 'Leave Requests'}
                  {location.pathname === '/confirm-payment' && 'Confirm Payment'}
                  {location.pathname === '/payslips' && 'Payslips'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <AnimatedIcon icon={NotificationsIcon}>
                  <NotificationsIcon sx={{ color: '#a1a1aa', cursor: 'pointer' }} />
                </AnimatedIcon>
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(90deg, #1bd1fe 0%, #8920fe 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.1)',
                  }
                }}>
                  <AccountCircleIcon sx={{ color: 'white' }} />
                </Box>
              </Box>
            </Toolbar>
          </AppBar>

          {/* Page content based on route */}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/employees" element={<EmployeeDirectory />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/leave-requests" element={<LeaveRequests />} />
            <Route path="/confirm-payment" element={<ConfirmPayment />} />
            <Route path="/payslips" element={<Payslips />} />
          </Routes>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

// Wrapper component to provide location context
function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}

export default AppWrapper;
