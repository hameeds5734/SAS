
import React from 'react';
import Box from'@mui/material/Box';
import Tab from '@mui/material/Tab';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import TextField from"@mui/material/TextField";
import Autocomplete from'@mui/material/Autocomplete';
import {Row, Col,Stack,Form, Button, Container} from "react-bootstrap";

const AddCustomer=()=>{ return (<div>
<h2>Add Customer</h2> 
<div className="d-flex justify-content-center">
<Box sx={{width:400,height:300}} >
<Stack gap={3} className='mt-3'>
<TextField label="Name" id="outlined-size-small" size="small"/>
<TextField label="Place" id="outlined-size-small" size="small"/>
<TextField label="Phone" id="outlined-size-small" size="small"/>
<div><Stack gap={3}
className="-flex justify-content-center"direction="horizontal">
<Button
variant="primary">Reset</Button>
<Button
variant="success" >ADD</Button>
</Stack> </div>
</Stack>
</Box> </div>
</div>)
}
const EditCustomer=()=>{
return (<div>
<h2>Edit Customer</h2> <div className="d-flex justify-content-center"><Box sx= {{width:400,height:300}} >
<Stack gap={3} className='mt-3'>
<div className="row">
<Autocomplete
disablePortal className="col-md-9" id=" combo-box-demo" options={['ss','ess', 'dsss','ass']}
size="small"
renderInput={ (params) =>
<TextField {...params} label="Customer Name"
/>}
/> <Button variant="success"
className="col-md-2 offset-md-1">Find</Button>
</div>
<TextField label="Place" id="outlined-size-small" size="small"/>
<TextField label="Phone" id="outlined-size-small" size="small"/>
<div><Stack gap={3}
className="-flex justify-content-center"direction="horizontal">
<Button
variant="success">Save</Button>

<Button
variant="danger">delete</Button>
</Stack>
</div>
</Stack>
</Box>
</div> </div>)
}
const AddProduct=()=>{
return (<div>
<h2>Add Product</h2> <div className="d-flex justify-content-
center"><Box sx={{width:700,height:100}} >
<div className='mt-3 row'>
<TextField className="col-md-8" label="Base Product" id="outlined-size-small" size="small"/>
<Button
variant="success"className="col-md-3 offset-1">Add</Button>
</div>
</Box> </div>
<hr></hr>
<div className="d-flex iustify-content-
center"><Box sx={{width:400,height: 160}} >
<Stack gap={3} className='mt-3'>
<Autocomplete disablePortal id="combo-box-demo" options=
{['ss','ess', 'dsss', 'ass']}
sx={{ width: 400}} size="small" renderInput={(params) =>
<TextField {...params} label= "Base Product" />}/>
<TextField label="Sub Product" id="outlined-size-small" size="small"/>
<div><Stack gap={3}
className="d-flex justify-content-center"direction="horizontal">
<Button
variant="primary">Reset</Button>

<Button
variant="success">Save Product</Button>
</Stack>
</div>
</Stack>
</Box> </div>
</div>)
}
const EditProduct=()=>{
return (<div>
<h2>Edit Product</h2> <div className="d-flex justify-content-
center"><Box sx={{width:400,height:300}} >
<Stack gap={3} className='mt-3'>
<div className="row">
<Autocomplete
disablePortal className="col-md-9" id=" combo-box-demo" options=
{['ss','ess','dsss','ass']}
size="small"
renderInput={ (params) =>
<TextField {...params} label="Base Product" />}
/> <Button variant="success"
className="col-md-2 offset-md-1">Find</Button> </div>
<TextField label="Sub product" id="outlined-size-small" size="small"
/>
<div><Stack gap={3}
className="d-flex justify-content-center"direction="horizontal">
<Button
variant="danger">delete</Button>
</Stack> </div>
</Stack>
</Box> </div>
</div>)
}

const AccountCreation=()=>{
const [value, setValue] =React.useState ('1');

const handleChange = (event, newValue) =>{
setValue (newValue);
};
return (<div>
<Box sx={{ width: '100%', typography:'bodyl' }}>
<TabContext value={value}>
<Box sx={{ borderBottom: 1, borderColor:
'divider' }}>
<TabList onChange={handleChange} aria-
label="lab API tabs example">
<Tab label="Add Customer" value="1" />
<Tab label="Edit Customer" value="2"/>
<Tab label="Add Product" value="3" />
<Tab label="Edit Product" value="4"
/>
</TabList>
</Box>

<TabPanel value="1"><AddCustomer /></TabPanel>
<TabPanel value="2"><EditCustomer/></TabPanel>
<TabPanel value="3"><AddProduct/></TabPanel>
<TabPanel value="4"><EditProduct /></TabPanel>
</TabContext>
</Box>
<div className="mt-3 container">
<Stack gap={3}
direction="horizontal">
<Button className="ms-auto"
variant="success">Home</Button>
</ Stack> </div>
</div>)}
export default AccountCreation;