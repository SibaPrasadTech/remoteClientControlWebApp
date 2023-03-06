import React, { useRef, useState } from 'react'
import { useEffect} from 'react'
import './index.css';
import io from 'socket.io-client'
const socket = io.connect('http://localhost:3002');
function App() {
  const [userid,setUserid] = useState(0);
  const useridRef = useRef(0);
  const imgRef = useRef();
  const canvasRef = useRef();
  const [userChannelJoined,setUserChannelJoined] = useState(false);
  const [beid,setBeid] = useState(0); 
  const [newRequest,setNewRequest] = useState(true);
  const [remoteAccessResponse,setRemoteAccessResponse] = useState(false);
  const [waitingForResponse,setWaitingForResponse] = useState(true);
  const [socketMessage,setSocketMessage] = useState("");
  useEffect(()=>{
    socket.on("user-joined",(msg) => {
      if(msg.userid === useridRef.current){
        setUserChannelJoined(true);
      }
    })
    socket.on("remote-access-ack",(msg) => {
      if(msg.res){
        console.log("Received ACK");
        // WHY IS THIS HAPPENING TWICE
        socket.emit('join-remote-channel',{userid: useridRef.current, beid: msg.userid})
        setWaitingForResponse(false)
        setRemoteAccessResponse(true)
      }
      else {
        setWaitingForResponse(false)
        setRemoteAccessResponse(false)
        setNewRequest(true);
      }
    })
    socket.on("remote-user-joined", (msg)=>{
      if(msg.seid) setSocketMessage(`You are connected`)
    })

    socket.on("remote-stream",(msg) => {
      let context = canvasRef.current.getContext('2d')
      canvasRef.current.width = 900;
      canvasRef.current.height = 700;
      context.width = canvasRef.current.width;
      context.height = canvasRef.current.height;
      //imgRef.current.src = msg.stream
      let i = setInterval(() => {
        context.drawImage(msg.stream,0,0,context.width,context.height)
      },10);
    })
  },[])

  const joinUserChannel = () => {
    setUserChannelJoined(true);
    useridRef.current = userid;
    socket.emit("join-user-channel", {userid});
  }

  const handleRequestAccess = () => {
    setNewRequest(false)
    socket.emit("remote-access-request", {userid,beid})
  }

  const handleLogOut = () => {
    setUserid(0);
    useridRef.current = 0;
    setBeid(0);
    setUserChannelJoined(false);
    setWaitingForResponse(true);
    setRemoteAccessResponse(false);
    setNewRequest(true);
  }

  return (
    <div className="App">
      <h1>CONTROL WEB APP</h1>
      {
        !userChannelJoined  ? 
          <div style={{display: "flex",flexDirection: "column"}}>
            <label htmlFor='userid'>Enter the userid</label>
            <input id="userid" type="text" placeholder="User ID" onChange={(e)=>setUserid(e.target.value)}></input>
            <button onClick = {joinUserChannel}>Join User Channel</button>
          </div> : <div>User ID : {userid} logged in.</div>
      }
      {
        newRequest ? 
        <div>
          <label htmlFor='beid'></label>
          <input id="beid" type="text" placeholder="Enter BE ID" onChange={(e)=>setBeid(e.target.value)}></input>
          <button onClick={(handleRequestAccess)}>Request Access</button>  
        </div> : <div>Request Sent to BE : {beid} Waiting for Response!</div>
      }
      {
        (!waitingForResponse && remoteAccessResponse) ? 
        <h1 style={{color: "green"}}>BE : {beid} accepted remote access request.</h1> : null
      }
      {
        (!waitingForResponse && !remoteAccessResponse) ? 
        <h1 style={{color: "red"}}>BE : {beid} denied remote access request.</h1> : null
      }
      {
        (socketMessage) ? <p>{socketMessage}</p> : null
      }
      <img ref={imgRef}></img>
      <canvas ref={canvasRef}  id="preview"></canvas>
      <button onClick={handleLogOut}>Logout</button>
    </div>
  );
}

export default App;
