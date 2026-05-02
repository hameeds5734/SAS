import React, {useState} from 'react';
import {Row, Col, Stack, Form,Button, Container} from 'react-bootstrap';
// import { Button } from 'primereact/button';
//import Input from '@mui/material-ui/core/Input';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import TextField from '@mui/material/TextField';
import './addbill.css'
import Autocomplete from'@mui/material/Autocomplete';

import { DataGrid } from '@mui/x-data-grid';
//for date

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
//import days from 'days';

const Addbill=()=>{
 const [a,setA]=useState ('');
 const [datevalue,setDatevalue]=useState (new Date ().toLocaleDateString ())

 const columns = [
    { field: 'name', headerName: 'Name', width: 180, editable: true },
    {
      field: 'age',
      headerName: 'Age',
      type: 'number',
      editable: true,
      align: 'left',
      headerAlign: 'left',
    },
    {
      field: 'dateCreated',
      headerName: 'Date Created',
      width: 180,
      editable: true,
    },
    {
      field: 'lastLogin',
      headerName: 'Last Login',
      width: 220,
      editable: true,
    },
  ];
  
  const rows = [
    {
      id: 1,
      name: 'name',
      age: 25,
      dateCreated: 'date',
      lastLogin: 'login',
    },
    {
      id: 2,
      name: 'name',
      age: 36,
      dateCreated: 'date',
      lastLogin: 'login',
    },
    {
      id: 3,
      name: 'name',
      age: 19,
      dateCreated: 'date',
      lastLogin: 'login',
    },
    {
      id: 4,
      name: 'name',
      age: 28,
      dateCreated: 'date',
      lastLogin: 'login',
    },
    {
      id: 5,
      name: 'name',
      age: 23,
      dateCreated: 'date',
      lastLogin: 'login',
    },
  ];
  
return (
        <div className='position_body'>
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
        sx={{ maxWidth: 494}}
        size="small"
        onChange=
        {(e,value)=>setA(value)}
        renderInput={(params) =>
        <TextField {...params} label="Customer Name"
        />}
        />
         <Autocomplete disablePortal id="combo-box-demo" options=
        {['ss','ess', 'dsss', 'ass']}
        sx={{ maxWidth: 494}} size="small" renderInput={(params) =>
        <TextField {...params} label= "Place" />}/>
        </Stack>
        </div>
        <div className="col-md-6 mt-3">
        <h2 >Total</h2>
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
        variant="primary">ADD</Button>
        </Stack>
        </div>
        <hr></hr>
        {/* <div className="container-fluid ">
        <div className="scroll-bar"> */}
        <div  className='d-flex justify-content-center'>
      <div style={{ height: 300, width: '80%' }}><DataGrid rows={rows} columns={columns} /></div>
      </div>
        {/* </div> </div> */}
        </section>
        <div className="mt-3 container">
        <Stack gap={3}
        direction="horizontal">
        <Button className="ms-auto"
        variant="primary">Reset</Button>
        <Button
        variant="primary">Home</Button>
        </Stack> </div>
        </div>
)
}
export default Addbill;

