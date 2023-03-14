import React, { useRef, useState } from 'react'
import { useEffect} from 'react'
import './index.css';
import io from 'socket.io-client'
const socket = io.connect('http://localhost:3002');
const rtcConfig = {
  iceServers: [{ urls: "stun:stun1.l.google.com:19302" }]
};
let remoteStream = new MediaStream();

function App() {
  const [userid,setUserid] = useState(0);
  const candidateRef = useRef([]);
  const useridRef = useRef(0);
  const videoRef = useRef();
  const videoDivRef = useRef();
  const pcRef = useRef(new RTCPeerConnection(rtcConfig));
  const [userChannelJoined,setUserChannelJoined] = useState(false);
  const [beid,setBeid] = useState(0); 
  const beidRef = useRef(0);
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
        socket.emit('join-remote-channel',{userid: useridRef.current, beid: msg.userid})
        beidRef.current = msg.userid;
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
      if(msg.seid) {
        setSocketMessage(`You are connected`);
      }
    })

    socket.on("remote-offer", async (msg) => {
      console.log("OFFER RECEIVED")
      startPeerConnection();
      await setRemoteDescriptionFun(msg.offer);
      let answerSDP = await createAnswer();
      socket.emit("remote-answer",{answer: answerSDP, userid: useridRef.current, beid: msg.beid});
    })

    socket.on("remote-ice-candidate", async (msg) => {
      console.log("CANDIDATE RECEIVED : ",msg.candidate);
      candidateRef.current = [...candidateRef.current,msg.candidate]
      //throttleFunction(addCandidate,250)();
      await addCandidate()
    })

    return () => {
      socket.removeAllListeners();
    }
  },[])
  const videoDivStyle = {
    position: 'absolute',
    top:'0px',
    right:'0px',
    bottom:'0px',
    left: '0px',
  }
  const throttleFunction=(func, delay)=>{
    let prev = 0;
    return (...args) => {
      let now = new Date().getTime();
      if(now - prev> delay){
        prev = now;
        return func(...args); 
      }
    }
  }
  const debounce = (func, timeout = 300) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
  }
  const startPeerConnection = () => {
    const _pc = new RTCPeerConnection(rtcConfig);
    _pc.onicecandidate = (e) => {
      if(e.candidate){
        // socket.emit("remote-ice-candidate",{ candidate: JSON.stringify(e.candidate),
        //   userid: useridRef.current,
        //   seid: seidRef.current})
        console.log("Candidate Created : ",useridRef.current)
      }
    }
    _pc.oniceconnectionstatechange = (e) => {
      console.log("ICE Conn State Change : ", e)
    }
    _pc.ontrack = (e) => {
      // receive the video stream
      console.log("Stream Received");
      console.log(e.streams.length);
      // e.streams[0].getTracks((track)=>{
      //   remoteStream.addTrack(track)
      // })
      // if(!videoRef.current.srcObject){
      //   videoRef.current.srcObject = e.streams[0];
      //   videoRef.current.onloadedmetadata = (e) => videoRef.current.play()
      // }
      videoDivRef.current.style = videoDivStyle
      videoRef.current.srcObject = e.streams[0];
      videoRef.current.onloadedmetadata = (e) => videoRef.current.play()
    } 
    pcRef.current = _pc
  }

  const createAnswer = async () => {
    try{
      const answerSDP = await pcRef.current.createAnswer()
      pcRef.current.setLocalDescription(answerSDP);
      return JSON.stringify(answerSDP);
    }
    catch(e){
      console.log("Error : ",e)
    }
  }

  const setRemoteDescriptionFun = async (offer) => {
    const offerSDPReceived = JSON.parse(offer);
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(offerSDPReceived));
  }

  const addCandidate = async () => {
    candidateRef.current.forEach( (candidate)=>{
      pcRef.current.addIceCandidate(JSON.parse(candidate))
      .then(() => {
        console.log("ADDED ICE CANDIDATES");
      })
      .catch(err => console.log(err))
    })
  }

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

  const handleMouseClick = () => {
    console.log("Mouse Click");
  }

  const handleMouseMove = ({clientX,clientY}) => {
    console.log("Mouse Move");
    if(beidRef.current){
      socket.emit('remote-mouse-move', {
        clientX,clientY, 
        clientWidth: window.innerWidth,
        clientHeight: window.innerHeight,
        userid: useridRef.current,
        beid: beidRef.current
      })
    }
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
      <div ref={videoDivRef} style={{display: 'block',backgroundColor: 'black',margin: 0}} onMouseMove={debounce(handleMouseMove,100)} onClick={handleMouseClick}>
          <video ref={videoRef} autoPlay={true}>video not available</video>
      </div>
      <button onClick={handleLogOut}>Logout</button>
    </div>
  );
}

export default App;
