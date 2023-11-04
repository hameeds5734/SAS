import React, {useState} from 'react';
import {Row, Col, Stack, Form, Button, Container} from 'react-bootstrap';
//import Input from '@mui/material-ui/core/Input';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import TextField from '@mui/material/TextField';
import Autocomplete from'@mui/material/Autocomplete';
//for date

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
//import days from 'days';

const Addbill=()=>{
 const [a,setA]=useState ('');
 const [datevalue,setDatevalue]=useState (new Date ().toLocaleDateString ())
return (<div>
<section className="container-fluid">
<div className="row">
<div className="col-md-6">
<Stack gap={2}
className="col-md-9 offset-1">
 <div className=" d-flex justify-content-start">
    
    <DatePicker
    label="Basic example" 
    inputFormat="DD-MM-YYYY"
    value={datevalue}
    onChange={ (newValue) => {
    setDatevalue (newValue);
    }}
    renderInput={ (params) => <TextField {...params} />}
    />
    </div> 
    
<Autocomplete
disablePortal
id=" combo-box-demo"
options={['ss','ess', 'dsss','ass']}
sx={{ width: 494}}
size="small"
onChange=
{(e,value)=>setA(value)}
renderInput={(params) =>
<TextField {...params} label="Customer Name"
/>}
/>
<TextField
label="Place"
id="outlined-size-small"
size="small"
/>
</Stack>
</div>
<div className="col-md-6 mt-3">
<h2>Total</h2>
<h2>54000</h2>
</div>
</div>
</section>
<section>
<div className="container mt-2">
<Stack direction="horizontal"
gap={2}>
<Autocomplete
disablePortal
id=" combo-box-demo"
options=
{['ss','ess', 'dsss',
'ass']}
sx={{ width: 400}}
size="small"
renderInput={(params) =>
<TextField {...params} label="Product" />}
/>
<Autocomplete
disablePortal
id=" combo-box-demo"
options=
{['ss','ess', 'dsss', 'ass']}
sx={{ width: 400}}
size="small"
renderInput={(params) =>
<TextField {...params} label="SubProduct" />}
/>
<TextField
label="Qty"
id="outlined-size-small"
size="small"
/>
<TextField
label="Amount"
id="outlined-size-small"
size="small"
/>
<TextField
label="Total"
id="outlined-size-small"
size="small"
/>
<Button
variant="success">ADD</Button>
</Stack>
</div>
<hr></hr>
<div className="container-fluid ">
<div className="scroll-bar">
<table class="table table-hover">
<thead className="bg-success fix" >
<tr>
<th scope="col">Id</th>
<th scope="col">Product</th>
<th scope="col">Qty</th>
<th scope="col">Price</th>
<th scope="col ">Total</th>
<th scope="col ">Delete</th>
</tr>
</thead>
<tbody >
<tr>
<th scope="row">1</th>
<td>Mark</td>
<td>Otto</td>
<td>@mdo</td>
<td> amo</td>
<td><DeleteOutlineOutlinedIcon
color='error'/></td>
</tr>
<tr>
<th scope="row">1</th>
<td>Mark</td>
<td>Otto</td>
<td>Amdo</td>
<td>amo</td>
<td><DeleteOutlineOutlinedIcon
color='error'/></td>
</tr>
<tr>
<th scope="row">1</th>
<td>Mark</td>
<td>Otto</td>
<td>Amdo</td>
<td>amo</td>
<td><DeleteOutlineOutlinedIcon
color='error'/></td>
</tr>
<tr>
<th scope="row">1</th>
<td>Mark</td>
<td>Otto</td>
<td>Amdo</td>
<td>amo</td>
<td><DeleteOutlineOutlinedIcon
color='error'/></td>
</tr>
<tr>
<th scope="row">1</th>
<td>Mark</td>
<td>Otto</td>
<td>Amdo</td>
<td>amo</td>
<td><DeleteOutlineOutlinedIcon
color='error'/></td>
</tr>
<tr>
<th scope="row">1</th>
<td>Mark</td>
<td>Otto</td>
<td>Amdo</td>
<td>amo</td>
<td><DeleteOutlineOutlinedIcon
color='error'/></td>
</tr>
<tr>
<th scope="row">1</th>
<td>Mark</td>
<td>Otto</td>
<td>Amdo</td>
<td>amo</td>
<td><DeleteOutlineOutlinedIcon
color='error'/></td>
</tr>
</tbody>
</table> </div> </div>
</section>
<div className="mt-3 container">
<Stack gap={3}
direction="horizontal">
<Button className="ms-auto"
variant="success">Reset</Button>
<Button
variant="success">Home</Button>
</Stack> </div>
</div>)
}
export default Addbill;

