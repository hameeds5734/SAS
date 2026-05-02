import * as React from 'react';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PeopleIcon from '@mui/icons-material/People';
import BarChartIcon from '@mui/icons-material/BarChart';
import LayersIcon from '@mui/icons-material/Layers';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { Link ,useNavigate} from 'react-router-dom';

 

 const MainListItems = ()=>{
  const [selectedIndex, setSelectedIndex] = React.useState(1);
  const navigate = useNavigate();
  
  const handleListItemClick = (event,index,path)=> {
        navigate(path);
        setSelectedIndex(index)
  }
  return(
    <React.Fragment>
    <ListItemButton onClick={(event)=>handleListItemClick(event, 0,'/addbill')}
    selected={selectedIndex === 0}>
      <ListItemIcon>
        <DashboardIcon />
      </ListItemIcon>
      <ListItemText primary="Add Bill" />
    </ListItemButton>
    <ListItemButton onClick={(event)=>handleListItemClick(event, 1,'/ac')}
    selected={selectedIndex === 1}>
      <ListItemIcon>
        <ShoppingCartIcon />
      </ListItemIcon>
      <ListItemText primary="Party Creation" />
    </ListItemButton>
    <ListItemButton onClick={(event)=>handleListItemClick(event, 2,'/vib')}
    selected={selectedIndex === 2}>
      <ListItemIcon>
        <PeopleIcon />
      </ListItemIcon>
      <ListItemText primary="Customers" />
    </ListItemButton>
    <ListItemButton onClick={(event)=>handleListItemClick(event, 3,'/balance')}
    selected={selectedIndex === 3}>
      <ListItemIcon>
        <BarChartIcon />
      </ListItemIcon>
      <ListItemText primary="Reports" />
    </ListItemButton>
    <ListItemButton onClick={(event)=>handleListItemClick(event, 4,'/eds')}
    selected={selectedIndex === 4}>
      <ListItemIcon>
        <LayersIcon />
      </ListItemIcon>
      <ListItemText primary="Integrations" />
    </ListItemButton>
    <ListItemButton onClick={(event)=>handleListItemClick(event, 5,'/dds')}
    selected={selectedIndex === 5}>
      <ListItemIcon>
        <LayersIcon />
      </ListItemIcon>
      <ListItemText primary="Integrations" />
    </ListItemButton>
    <ListItemButton onClick={(event)=>handleListItemClick(event, 6,'/dvb')}
    selected={selectedIndex === 6}>
      <ListItemIcon>
        <LayersIcon />
      </ListItemIcon>
      <ListItemText primary="Integrations" />
    </ListItemButton>
  </React.Fragment>
  )
}

export default MainListItems
  



