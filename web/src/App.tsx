import { Component, createEffect, createMemo, createSignal } from 'solid-js';
import { CallLogo } from './components/call';
import { Vid } from './components/vid';
import { Mic } from './components/mic';
import { LoadSpinner } from './components/loader';
import { io } from 'socket.io-client';

var ws = io('wss://api.danecwalker.com', {
  transports: ['websocket', 'polling'],
  path: '/call/socket.io',
});

const config: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
      ]
    },
    {
      urls: "turn:192.46.220.156:3478",
      credential: "myturner1234",
      username: "turner"
    }
  ]
}
const pc = new RTCPeerConnection(config);

const App: Component = () => {
  let local_vid   : HTMLVideoElement,
      remote_vid  : HTMLVideoElement;

  let local_stream   : MediaStream,
      remote_stream  : MediaStream;
    
  const [call, callSet] = createSignal(false);
  const [isLoading, isLoadingSet] = createSignal(true);

  const [state, stateSet] = createSignal<{users: string[], msgs: {self: boolean, msg: string, msgTime: Date}[], calls: string[], currentCall: string}>({users: [], msgs: [], calls: [], currentCall: ""});

  createEffect(() => {
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach(track => {
        remote_stream.addTrack(track);
      })
    }

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case "connected":
          const audio = new Audio(`https://api.danecwalker.com/call/sounds/ns1.mp3`);
          audio.play(); 
          isLoadingSet(false);
          break;
        
        case "disconnected":
          endCall();
        default:
          break;
      }
    }

    ws.on("connect", () => {
    })

    ws.on("users", (users) => {
      console.log(users)
      stateSet(p => ({...p, users}));
    })

    ws.on("new-user", (user: string) => {
      stateSet(p => ({...p, users: [...p.users, user]}));
    })

    ws.on("user-disconnected", (user: string) => {
      stateSet(p => ({...p, users: p.users.filter(u => u !== user)}));
    })

    ws.on("callOffer", (from: string) => {
      stateSet(p => ({...p, calls: [...p.calls, from]}));
      const audio = new Audio(`https://api.danecwalker.com/call/sounds/ns2.mp3`);
      audio.play(); 
    })

    ws.on("declineCallOffer", (from: string) => {
      callSet(false);
      stateSet(p => ({...p, currentCall: ""}))
      local_stream = null;
      local_vid.srcObject = null;
    })

    ws.on("acceptCallOffer", (from: string) => {
      makeOffer(from)
    })

    ws.on("sdp", ({from, sdp}: {from:string, sdp:RTCSessionDescriptionInit}) => {
      if (sdp.type === "offer") {
        makeAnswer(from, sdp)
      } else {
        setRemoteSdp(sdp)
      }
    })

    ws.on("msg", ({msg}) => {
      let msgTime = new Date()
      stateSet(p => ({...p, msgs: [...p.msgs, {self:false, msg, msgTime}]}))
      setTimeout(() => {
        let m = document.getElementById(`msg:${msgTime.getUTCSeconds()}`)
        m.classList.add("animate-fade")
        setTimeout(() => {
          stateSet(p => ({...p, msgs: p.msgs.filter(m => m.msgTime !== msgTime)}))
        } , 1000)
      }, 5000)
    })
  })

  ws.on("iceCandidate", ({from, candidate}: {from:string, candidate:RTCIceCandidate}) => {
    pc.addIceCandidate(candidate)
  })

  const findUser = (e) => {
    e.preventDefault();
    const user = e.target.user.value;
    if (user.trim() !== '') {
      e.target.user.value = "";
    }
  }

  const startCall = async (user) => {
    callSet(true)
    stateSet(p => ({...p, currentCall: user}))
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: {
      width: { min: 640, ideal: 1280, max: 1920 },
      height: { min: 480, ideal: 720, max: 1080 }
    } })

    local_stream = stream;
    local_vid.srcObject = stream;
    remote_stream = new MediaStream();
    remote_vid.srcObject = remote_stream;

    pc.onicecandidate = (e) => {
      e.candidate && ws.emit("iceCandidate", {to: user, candidate: e.candidate});
    }

    local_stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    })
    
    ws.emit("callOffer", user);
  }

  const setRemoteSdp = async (sdp : RTCSessionDescriptionInit) => {
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  const acceptCallOffer = async (user) => {
    callSet(true);
    stateSet(p => ({...p, currentCall: user}))
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: {
      width: { min: 640, ideal: 1280, max: 1920 },
      height: { min: 480, ideal: 720, max: 1080 }
    } })

    local_stream = stream;
    local_vid.srcObject = stream;
    remote_stream = new MediaStream();
    remote_vid.srcObject = remote_stream;

    pc.onicecandidate = (e) => {
      e.candidate && ws.emit("iceCandidate", {to: user, candidate: e.candidate});
    }

    local_stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    })

    ws.emit("acceptCallOffer", user);
  }

  const declineCallOffer = (user) => {
    ws.emit("declineCallOffer", user);
    stateSet(p => ({...p, calls: p.calls.filter(u => u !== user)}));
  }

  const makeOffer = async (to: string) => {
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await pc.setLocalDescription(offer);
    
    ws.emit("sdp", {to, sdp: offer});
  }

  const makeAnswer = async (from: string, sdp: RTCSessionDescriptionInit) => {
    setRemoteSdp(sdp)
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    ws.emit("sdp", {to: from, sdp: answer});
  }

  const endCall = () => {
    local_stream.getTracks().forEach(track => {
      track.stop();
    })
    remote_stream.getTracks().forEach(track => {
      track.stop();
    })
    pc.close()
    local_stream = null;
    local_vid.srcObject = null;
    remote_stream = null;
    remote_vid.srcObject = null;
    callSet(false);
    stateSet(p => ({...p, currentCall: "", calls: [...p.calls.filter(u => u !== p.currentCall)]}))
  }

  const sendMsg = (e) => {
    e.preventDefault()
    const msg = e.target.msg.value;
    if (msg.trim() !== '') {
      e.target.msg.value = "";
      ws.emit("msg", {msg, to: state().currentCall});
      let msgTime = new Date()
      stateSet(p => ({...p, msgs: [...p.msgs, {self:true, msg, msgTime}]}))
      setTimeout(() => {
        let m = document.getElementById(`msg:${msgTime.getUTCSeconds()}`)
        m.classList.add("animate-fade")
        setTimeout(() => {
          stateSet(p => ({...p, msgs: p.msgs.filter(m => m.msgTime !== msgTime)}))
        } , 1000)
      }, 5000)
    }
  }

  return (
    <div class='w-full h-screen overflow-hidden'>
      <div class={`w-full h-full grid ${call() ? "grid-cols-1" : "grid-cols-[24rem,1fr]"} justify-center items-center`}>
        <div class={`bg-slate-100 h-full flex flex-col overflow-scroll ${call() ? "hidden" : null}`}>
          <form onsubmit={findUser} class='w-full sticky top-0 z-50 bg-slate-100 p-4'>
            <input class='p-2 rounded-lg w-full' type="text" id='user' placeholder='Search Username' />
          </form>

          <div class='flex flex-col gap-4 p-4'>
            {
              state().users.map(user => (
                <div class='cursor-pointer group relative p-8 overflow-hidden rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors'>
                  <h1 class='font-bold mb-1'>{user}</h1>
                  <h4 class='text-xs text-green-500 bg-green-500/20 py-1 px-2 rounded w-fit'>Online</h4>
                  <div onclick={() => startCall(user)} class='w-10 h-10 absolute top-1/2 right-8 -translate-y-1/2'>
                    <CallLogo />
                  </div>
                  {
                    state().calls.includes(user) ? 
                    <div class='flex gap-2 mt-2'>
                      <button onclick={() => acceptCallOffer(user)} class='bg-green-400 text-white px-2 py-1 text-sm rounded-lg'>Accept</button>
                      <button onclick={() => declineCallOffer(user)} class='bg-red-500 text-white px-2 py-1 text-sm rounded-lg'>Decline</button>
                    </div> : null
                  }
                </div>
              ))
            }
          </div>
          
        </div>
        <div class='relative bg-slate-200 h-full overflow-hidden'>
          <div class={`absolute top-1/2 left-1/2 w-16 h-16 z-50 -translate-x-1/2 -translate-y-1/2 ${call() && isLoading() ? "opacity-100" : "opacity-0"} transition-opacity duration-1000 delay-1000`}>
            <LoadSpinner />
          </div>
          <div class='absolute w-full max-w-screen-lg left-1/2 -translate-x-1/2 h-80 bottom-24 flex flex-col gap-2 justify-end overflow-hidden px-4'>
            {
              state().msgs.map((msg, i) => {
                if (msg.self) {
                  return (
                    <div id={`msg:${msg.msgTime.getUTCSeconds()}`} class='bg-blue-400 text-white max-w-2xl w-fit px-4 py-2 rounded-3xl text-left self-start'>
                      {msg.msg}
                    </div>
                  )
                } else {
                  return (
                    <div id={`msg:${msg.msgTime.getUTCSeconds()}`} class='bg-slate-300 text-black max-w-2xl w-fit px-4 py-2 rounded-3xl text-right self-end'>
                      {msg.msg}
                    </div>
                  )
                }
              })
            }
          </div>
          <video ref={remote_vid} class={`w-full h-full object-contain ${call() ? "bg-black" : null} transition-colors duration-1000`} autoplay playsinline></video>
          <video ref={local_vid} class={`absolute top-8 right-8 w-60 scale-x-[-1] aspect-[3/2] object-contain`} autoplay playsinline muted></video>
          <div class={`absolute left-0 right-0 bottom-0 rounded-t-lg bg-black/50 backdrop-blur-lg p-4 transition-transform duration-1000 ${call() ? "translate-y-0" : "translate-y-full"}`}>
            <div class='flex gap-4 justify-center items-center w-full h-full max-w-screen-lg mx-auto'>
              <form onsubmit={sendMsg} class='w-full'>
                <input class='p-2 rounded-lg w-full bg-white/10 text-white placeholder:text-white/40 caret-white border-none outline-none' type="text" id='msg' placeholder='Message' />
              </form>
              <Vid />
              <Mic />
              <button onclick={endCall} class="block bg-red-500 px-3 py-1.5 text-sm text-white rounded-full">End</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
