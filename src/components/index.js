import React from 'react';
import { Link ,useNavigate} from 'react-router-dom';
const Home=()=>{

  
    const navigate = useNavigate();

    return(<div>
        <br></br><br></br>
        <div className="flex container">
        <div className=" row">
        
        <div onClick={()=>navigate('/addbill')}class="card col card-wh">
          <div class="card-body center">
            <h5 class="card-title">Add Bill</h5>
          </div>
        </div>
       
        <div onClick={()=>navigate('/ac')}class="card col card-wh" >
          <div class="card-body center">
            <h5 class="card-title">User Account & Product Creation</h5>
          </div>
        </div>
        
        </div>
        <div className=" row">
        <div onClick={()=>navigate('/vib')}class="card col card-wh">
          <div class="card-body center">
            <h5 class="card-title">view individual bills</h5>
          </div>
        </div>
        <div onClick={()=>navigate('/balance')}class="card col card-wh" >
          <div class="card-body center">
            <h5 class="card-title">balance(baaki pattiyal)</h5>
          </div>
        </div>
        </div>
        <div className=" row">
        <div onClick={()=>navigate('/eds')}class="card col card-wh">
          <div class="card-body center">
            <h5 class="card-title">Exact Daily Sale</h5>
          </div>
        </div>
        <div onClick={()=>navigate('/dds')}class="card col card-wh" >
          <div class="card-body center">
            <h5 class="card-title">Detailed Daily Sale</h5>
          </div>
        </div>
        </div>
        <div className=" row">
        <div onClick={()=>navigate('/dvb')}class="card col card-wh">
          <div class="card-body center">
            <h5 class="card-title">Detail View bill</h5>
          </div>
        </div>
        <div onClick={()=>navigate('/')}class="card col card-wh" >
          <div class="card-body center">
            <h5 class="card-title">setting </h5>
          </div>
        </div>
        </div>
        </div>
    </div>)
}

export default Home;