/* Reel Legends GFX — Three.js sky + water layers.
   Each layer is a full-screen shader rendered at reduced resolution into its own WebGL canvas,
   then blitted into the game's 2D canvas (so fish/boat/etc. still layer on top as before).
   If anything fails (no WebGL, context lost) RLGL.ready turns false and the game uses its 2D drawing. */
(function(){
  const VS='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const COMMON=`
precision highp float;
varying vec2 vUv;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.03+17.;a*=.5;}return s;}
uniform vec4 uRect; uniform float uTime; uniform float uSURF;
vec2 worldPos(){return vec2(uRect.x+vUv.x*uRect.z,uRect.y+(1.-vUv.y)*uRect.w);}
`;
  const SKY=COMMON+`
uniform vec3 uC0,uC1,uSunCol,uCloudCol;
uniform vec2 uSun; uniform float uSunStr,uWarm,uNight,uCover,uGloom;
void main(){
  vec2 w=worldPos();
  float t=clamp(w.y/uSURF,0.,1.);
  float kk=t<.7?t/.7*.6:.6+(t-.7)/.3*.4;
  vec3 col=mix(uC0,uC1,kk);
  /* sun bloom + warm horizon glow */
  float d=distance(w,uSun);
  float glow=exp(-d/280.)*.26+exp(-d/90.)*.2;
  col+=uSunCol*glow*uSunStr;
  col+=uSunCol*uWarm*.3*exp(-max(uSURF-w.y,0.)/130.)*exp(-abs(w.x-uSun.x)/760.)*uSunStr;
  /* stars */
  if(uNight>.02){
    vec2 cell=floor(w/26.);float h=hash(cell);
    if(h>.84){
      vec2 sp=(cell+vec2(hash(cell+3.1),hash(cell+7.7)))*26.;
      float sd=distance(w,sp);
      float tw=.55+.45*sin(uTime*2.+h*60.);
      float st=smoothstep(2.4+h*1.6,0.,sd)*tw*(.45+(h-.84)*3.4);
      col+=vec3(.9,.95,1.)*st*uNight*smoothstep(.95,.55,t)*(1.-uCover*.7);
    }
  }
  /* sun disc */
  col=mix(col,uSunCol,smoothstep(36.,32.,d)*uSunStr);
  /* clouds: two drifting layers */
  float mask=smoothstep(-70.,40.,w.y)*smoothstep(uSURF-10.,uSURF-190.,w.y);
  float th=mix(.7,.34,uCover);
  for(int k=0;k<2;k++){
    float fk=float(k);
    vec2 p=vec2(w.x*(.0034+fk*.0016)+uTime*(.010+fk*.007)+fk*9.,w.y*(.0105+fk*.004));
    float dd=fbm(p);
    float cl=smoothstep(th+fk*.04,th+.22+fk*.04,dd)*mask*(1.-fk*.3)*(.35+.65*uCover);
    vec2 toSun=normalize(uSun-w+vec2(.001))*.035;
    float d2=fbm(p+toSun*vec2(1.,2.));
    float shade=clamp((dd-d2)*5.+.55,0.,1.);
    float rim=(1.-smoothstep(th,th+.1,dd))*smoothstep(th-.06,th,dd);
    vec3 cc=mix(uCloudCol*.62,uCloudCol,shade);
    cc+=uSunCol*rim*uSunStr*.5;
    cc*=1.-.58*uGloom;
    col=mix(col,cc,cl*.94);
  }
  col+=(hash(w*.7+uTime)-.5)/255.;
  gl_FragColor=vec4(col,1.);
}`;
  const WATER=COMMON+`
uniform float uFLOOR,uLight,uNight,uRays;
uniform vec3 uCol[6]; uniform float uPos[6]; uniform int uN;
vec3 grad(float d){
  vec3 c=uCol[0];
  for(int i=1;i<6;i++){ if(i<uN){ float a=uPos[i-1],b=uPos[i]; c=mix(c,uCol[i],clamp((d-a)/max(b-a,1e-4),0.,1.)); } }
  return c;
}
float caustic(vec2 uv,float t){
  vec2 p=mod(uv*6.28318,6.28318)-250.; vec2 i=p; float c=1.; float inten=.005;
  for(int n=0;n<4;n++){
    float tt=t*(1.-(3.5/float(n+1)));
    i=p+vec2(cos(tt-i.x)+sin(tt+i.y),sin(tt-i.y)+cos(tt+i.x));
    c+=1./length(vec2(p.x/(sin(i.x+tt)/inten),p.y/(cos(i.y+tt)/inten)));
  }
  c/=4.; c=1.17-pow(c,1.4);
  return pow(abs(c),8.);
}
void main(){
  vec2 w=worldPos();
  float dy=max(w.y-uSURF,0.);
  float d=clamp((w.y-uSURF)/(uFLOOR-uSURF),0.,1.);
  vec3 col=grad(d);
  /* slow murk variation so the gradient never looks flat */
  col*=1.+(fbm(w*.0011+vec2(uTime*.012,0.))-.5)*.14;
  float L=uLight;
  /* caustics, strongest near the surface */
  vec2 wp=w+vec2(sin(w.y*.02+uTime*.7),cos(w.x*.016+uTime*.55))*5.;
  float ca=caustic(wp*.0042,uTime*.55);
  float cf=exp(-dy/330.)*.55+exp(-dy/1100.)*.12;
  col+=vec3(.70,1.,.95)*ca*cf*L*(.35+.65*uRays);
  /* god rays: slanted drifting beams */
  float rays=0.;
  for(int k=0;k<4;k++){
    float fk=float(k);
    float xs=w.x+dy*.34;
    float b=sin(xs*(.0105+fk*.0038)+uTime*(.16+fk*.06)+fk*2.3);
    rays+=pow(max(b,0.),7.)*(.62-fk*.1);
  }
  rays*=smoothstep(0.,70.,dy)*exp(-dy/760.);
  col+=vec3(.72,1.,.97)*rays*.2*L*uRays;
  /* bright shimmer right under the surface */
  float sh=smoothstep(46.,0.,dy)*(.07+.16*noise(vec2(w.x*.045+uTime*.9,w.y*.14+uTime*.4)));
  col+=vec3(.85,1.,.98)*sh*L;
  col+=(hash(w*.7+uTime)-.5)/255.;
  gl_FragColor=vec4(col,1.);
}`;

  const RLGL=window.RLGL={ready:false,fail:false,_sky:null,_wat:null};
  const hexv=h=>{h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return[parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255]};

  function layer(frag,uniforms){
    const canvas=document.createElement('canvas');
    const r=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:false});
    r.setPixelRatio(1);
    const sc=new THREE.Scene(),cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    const m=new THREE.ShaderMaterial({uniforms,vertexShader:VS,fragmentShader:frag,depthTest:false,depthWrite:false});
    sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),m));
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();RLGL.ready=false;RLGL.fail=true});
    let W=0,H=0;
    return{canvas,u:uniforms,render(w,h){if(w!==W||h!==H){r.setSize(w,h,false);W=w;H=h}r.render(sc,cam)}};
  }

  RLGL.init=function(){
    if(RLGL.ready||RLGL.fail||!window.THREE)return;
    try{
      const V=()=>new THREE.Vector3(),V2=()=>new THREE.Vector2(),V4=()=>new THREE.Vector4();
      RLGL._sky=layer(SKY,{uRect:{value:V4()},uTime:{value:0},uSURF:{value:330},uC0:{value:V()},uC1:{value:V()},uSunCol:{value:V()},uCloudCol:{value:V()},
        uSun:{value:V2()},uSunStr:{value:0},uWarm:{value:0},uNight:{value:0},uCover:{value:.3},uGloom:{value:0}});
      const cols=[],pos=[];for(let i=0;i<6;i++){cols.push(V());pos.push(0)}
      RLGL._wat=layer(WATER,{uRect:{value:V4()},uTime:{value:0},uSURF:{value:330},uFLOOR:{value:4330},uLight:{value:1},uNight:{value:0},uRays:{value:1},
        uCol:{value:cols},uPos:{value:pos},uN:{value:4}});
      RLGL.ready=true;
    }catch(e){RLGL.fail=true;RLGL.ready=false;try{console.warn('RLGL init failed',e)}catch(_){}}
  };

  /* o: {x,y,w,h (world rect), s (canvas scale = SC*DPR), q (resolution factor), ...uniform values} */
  function blit(ctx,L,o){
    const w=Math.max(2,Math.round(o.w*o.s*o.q)),h=Math.max(2,Math.round(o.h*o.s*o.q));
    L.u.uRect.value.set(o.x,o.y,o.w,o.h);
    L.render(w,h);
    return{w,h};
  }

  RLGL.sky=function(ctx,o){
    if(!RLGL.ready)return false;
    try{
      const L=RLGL._sky,u=L.u;
      u.uTime.value=o.time;u.uSURF.value=o.surf;
      u.uC0.value.set(o.c0[0]/255,o.c0[1]/255,o.c0[2]/255);u.uC1.value.set(o.c1[0]/255,o.c1[1]/255,o.c1[2]/255);
      u.uSunCol.value.set(o.sunCol[0]/255,o.sunCol[1]/255,o.sunCol[2]/255);
      u.uCloudCol.value.set(o.cloudCol[0]/255,o.cloudCol[1]/255,o.cloudCol[2]/255);
      u.uSun.value.set(o.sunX,o.sunY);u.uSunStr.value=o.sunStr;u.uWarm.value=o.warm;u.uNight.value=o.night;u.uCover.value=o.cover;u.uGloom.value=o.gloom;
      blit(ctx,L,o);
      ctx.imageSmoothingEnabled=true;ctx.drawImage(L.canvas,o.x,o.y,o.w,o.h);
      return true;
    }catch(e){RLGL.ready=false;RLGL.fail=true;return false}
  };

  /* draws into the current clip path (caller clips to the water shape) */
  RLGL.water=function(ctx,o){
    if(!RLGL.ready)return false;
    try{
      const L=RLGL._wat,u=L.u;
      u.uTime.value=o.time;u.uSURF.value=o.surf;u.uFLOOR.value=o.floor;u.uLight.value=o.light;u.uNight.value=o.night;u.uRays.value=o.rays;
      const n=Math.min(6,o.stops.length);u.uN.value=n;
      for(let i=0;i<6;i++){const s=o.stops[Math.min(i,n-1)];u.uPos.value[i]=s[0];const c=hexv(s[1]);u.uCol.value[i].set(c[0],c[1],c[2])}
      blit(ctx,L,o);
      ctx.imageSmoothingEnabled=true;ctx.drawImage(L.canvas,o.x,o.y,o.w,o.h);
      return true;
    }catch(e){RLGL.ready=false;RLGL.fail=true;return false}
  };
})();
