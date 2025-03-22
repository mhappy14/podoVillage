import React, { useEffect, useRef } from "react";
import { Box, Button, FormControl, InputLabel, Select, MenuItem, Stack, Pagination, Typography } from '@mui/material';
import * as motion from "motion/react-client"
import { Fade, Slide, Bounce, Reveal, Hinge, Rotate, Roll, JackInTheBox  } from "react-awesome-reveal";
import 'animate.css';
import { Link } from 'react-router-dom';

const About = () => {

  return (
    <div className="AboutBG" >
      <Fade cascade damping={6}>
      {/* 첫 번째 세로 스크롤 영역 (0 ~ 2340px) */}
      <div style={{ position: 'relative', height: '5vh' }}>
        <div className="section1" >
          <div style={{ position: 'absolute', zIndex: 2 }}>
            <Box sx={{ display: 'flex'}}>
              <div className="section1text1 animate__animated animate__bounce animate__delay-2s">Welcome to</div>
              <div style={{ display: 'flex', width: '500px', marginLeft: '20px', gap: '1rem' }}>
                <div className="section1text2 animate__animated animate__bounceOutLeft animate__delay-0.5s">포</div>
                <div className="section1text2 animate__animated animate__bounceOut animate__delay-0.5s">도</div>
                <div className="section1text2 animate__animated animate__bounceOutUp animate__delay-1s">마</div>
                <div className="section1text2 animate__animated animate__bounceOutRight animate__delay-1s">을</div>
              </div>
            </Box>
          </div>
          <div style={{ position: 'absolute', zIndex: 1 }}>
            <Box sx={{ display: 'flex'}}>
              <div className="section1text1 animate__animated animate__fadeOut animate__delay-0s">Welcome to</div>
              <div style={{ display: 'flex', width: '500px', marginLeft: '20px' }}>
                <div className="section1text2 animate__animated animate__bounceInLeft animate__delay-4s">P</div>
                <div className="section1text2 animate__animated animate__rotateInDownLeft animate__delay-4s">o</div>
                <div className="section1text2 animate__animated animate__bounceInUp animate__delay-3s">d</div>
                <div className="section1text2 animate__animated animate__flipInX animate__delay-3s">o</div>
                <div className="section1text2 animate__animated animate__bounceInDown animate__delay-5s">
                  <span className="font-color-change-5x">V</span>
                </div>
                <div className="section1text2 animate__animated animate__flipInX animate__delay-3s">i</div>
                <div className="section1text2 animate__animated animate__bounceInUp animate__delay-3s">ll</div>
                <div className="section1text2 animate__animated animate__rotateInDownRight animate__delay-3s">a</div>
                <div className="section1text2 animate__animated animate__lightSpeedInRight animate__delay-4s">g</div>
                <div className="section1text2 animate__animated animate__bounceInRight animate__delay-4s">e</div>
              </div>
            </Box>
          </div>
        </div>
      </div>

      <div className="section2 color-change-5x" >
        <div style={{ width: '440px', marginLeft: '4rem'}} >
          <div style={{ width: '430px', paddingTop:'2rem'}} className="section2text1 animate__animated animate__pulse animate__slow animate__infinite">여러분의 생각을 글로 자유롭게 표현하세요</div>
        </div>
        <motion.div animate={{x:[150, 750, 150]}} transition={{duration: 6, ease: "easeInOut", times: [0, 1, 1, 1], repeat: Infinity, repeatDelay: 0}}>
          <div style={{ width: '430px', margintop:'1rem'}} className="section2text1">다른분의 글에 의견을 보내주세요</div>
        </motion.div>
        <Box sx={{ display: 'flex'}}>
          <motion.div animate={{x:[100], y:[-27], backgroundColor: ["#ff0088", "#0d63f8", "#ff0088"], rotate: [0, 180, 360, 540], borderRadius: ["30%"]}}
           transition={{duration: 3, ease: "easeInOut", times: [0, 1, 1, 1], repeat: Infinity, repeatDelay: 0}} style={box1}/>
          <motion.div animate={{x:[1030], y:[-27], backgroundColor: ["#ff0088", "#0d63f8", "#ff0088"], rotate: [0, -180, -360, -540], borderRadius: ["30%"]}}
           transition={{duration: 3, ease: "easeInOut", times: [0, 1, 1, 1], repeat: Infinity, repeatDelay: 0}} style={box1}/>
        </Box>
        
        <div>
          <div style={{ display: 'flex'}}>
            <div style={{ width: '5%' }}></div>
            <div style={{ width: '30%'}}>
              <h2 className="tracking-in-contract" style={{ animationDelay: '7s'}}>Welcome to my world!</h2>
              </div>
            <div style={{ width: '30%'}}></div>
            <div style={{ width: '30%'}}></div>
            <div style={{ width: '5%' }}></div>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', marginBottom:'1rem'}}>
            <div style={{ width: '5%' }}></div>
            <div style={{ width: '90%'}}>
              <h3 className="tracking-in-contract" style={{ animationDelay: '8s'}}>현재까지 제작한 기능에 대하여 소개할게요.</h3>
              </div>
            <div style={{ width: '5%' }}></div>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', marginBottom:'1rem'}}>
            <div style={{ width: '5%' }}></div>
            <div style={{ width: '90%'}}>
              <div style={{ display: 'flex', gap:'2rem', width:'100%'}}>
                <div style={{ display: 'flex', width:'33%'}}>
                  <div style={{ width: '5%' }}></div>
                  <div className="roll-in-left" style={{ width: '90%', animationDelay: '9.8s'}}>
                      <h3 className="tabtitle  animate__animated animate__headShake animate__infinite">Study 탭은... </h3>
                      <Slide direction="left" cascade triggerOnce>
                        <h4 className="tabsummary">기술사자격증 공부를 하며 </h4>
                        <h4 className="tabsummary">자신만의 모범답안을 작성하고 </h4>
                        <h4 className="tabsummary">피드백을 얻는 수 있습니다.</h4>
                      </Slide>
                  </div>
                  <div style={{ width: '5%' }}></div>
                </div>
                <div style={{ display: 'flex', width:'33%'}}>
                  <div style={{ width: '5%' }}></div>
                  <div className="roll-in-top" style={{ width: '90%', animationDelay: '11.4s'}}>
                    <h3 className="tabtitle  animate__animated animate__headShake animate__infinite">Essay 탭은... </h3>
                    <Fade cascade>
                      <h4 className="tabsummary">학술논문, 학위논문을 읽고</h4>
                      <h4 className="tabsummary">필요한 내용을 발췌하여</h4>
                      <h4 className="tabsummary">메모할 수 있습니다.</h4>
                    </Fade>
                    </div>
                  <div style={{ width: '5%' }}></div>
                </div>
                <div style={{ display: 'flex', width:'33%'}}>
                  <div style={{ width: '5%' }}></div>
                  <div className="roll-in-right" style={{ width: '90%', animationDelay: '10.6s'}}>
                    <h3 className="tabtitle  animate__animated animate__headShake animate__infinite">Review 탭은...</h3>
                    <Bounce direction="down" cascade triggerOnce>
                      <h4 className="tabsummary">책, 영화, 공연을 감상하고</h4>
                      <h4 className="tabsummary">느낀점을 사람들과 공유할 수 있습니다.</h4>
                      <h4 className="tabsummary">제작 중입니다.</h4>
                    </Bounce>
                    </div>
                  <div style={{ width: '5%' }}></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap:'2rem', width:'100%', marginTop:'2rem'}}>
                <div style={{ display: 'flex', width:'33%'}}>
                  <div style={{ width: '5%' }}></div>
                  <div className="roll-in-left" style={{ width: '90%', animationDelay: '12.2s'}}>
                    <h3 className="tabtitle  animate__animated animate__headShake animate__infinite">Place 탭은... </h3>
                    <Rotate cascade triggerOnce>
                      <h4 className="tabsummary">거리, 공원, 건물 등</h4>
                      <h4 className="tabsummary">장소에 대한 의견을 공유할 수 있습니다.</h4>
                      <h4 className="tabsummary">제작 중입니다.</h4>
                    </Rotate>
                    </div>
                  <div style={{ width: '5%' }}></div>
                </div>
                <div style={{ display: 'flex', width:'33%'}}>
                  <div style={{ width: '5%' }}></div>
                  <div className="roll-in-bottom" style={{ width: '90%', animationDelay: '13.4'}}>
                    <h3 className="tabtitle  animate__animated animate__headShake animate__infinite">Know-how 탭은... </h3>
                    <Roll cascade triggerOnce>
                    <h4 className="tabsummary">공부, 취업, 결혼, 육아 등</h4>
                    <h4 className="tabsummary">살아가는데 필요한 절차의 방법을</h4>
                    <h4 className="tabsummary">공유할 수 있습니다.</h4>
                    </Roll>
                    </div>
                  <div style={{ width: '5%' }}></div>
                </div>
                <div style={{ display: 'flex', width:'33%'}}>
                  <div style={{ width: '5%' }}></div>
                  <div className="roll-in-right" style={{ width: '90%', animationDelay: '13s'}}>
                    <h3 className="tabtitle  animate__animated animate__headShake animate__infinite">Invest 탭은...</h3>
                    <JackInTheBox cascade triggerOnce>
                      <h4 className="tabsummary">소중한 우리의 자산을 지키기 위하여</h4>
                      <h4 className="tabsummary">경제를 이해하고 대처하는 방법을 공유할 수 있습니다.</h4>
                      <h4 className="tabsummary">제작 중 입니다.</h4>
                    </JackInTheBox>
                    </div>
                  <div style={{ width: '5%' }}></div>
                </div>
              </div>
            </div>
            <div style={{ width: '5%' }}></div>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', marginTop:'3rem', marginBottom:'1rem'}}>
            <div style={{ width: '5%' }}></div>
            <div style={{ width: '90%'}}>
              <h2 className="tracking-in-expand-fwd-bottom" style={{ animationDelay: '18s'}}>차근차근 양질의 웹사이트로 거듭나도록 하겠습니다😊</h2>
              </div>
            <div style={{ width: '5%' }}></div>
          </div>
        </div>

      </div>
      </Fade>
      <div className="section3" >
      </div>
    </div>
  );
};

const box1 = {
  width: 30,
  height: 30,
}

const box = {
  width: 100,
  height: 100,
  backgroundColor: "#f5f5f5",
  borderRadius: 5,
}


const ball = {
  width: 100,
  height: 100,
  backgroundColor: "#dd00ee",
  borderRadius: "50%",
}
export default About;

