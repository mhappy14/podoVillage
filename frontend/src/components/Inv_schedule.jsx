// ✅ Invest_schedule.jsx
import React, { useEffect, useState } from "react";
import { Card, Typography, Row, Col, Space } from "antd";
import { cpiSchedule, fomcSchedule } from "./Inv_schedule_date";

const { Title, Paragraph } = Typography;

function useNextEvent(schedule, timezoneOffset = "UTC-5") {
  const [nextEvent, setNextEvent] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const now = new Date();
    const sorted = [...schedule].sort((a, b) => new Date(`${a.date} ${a.time} ${timezoneOffset}`) - new Date(`${b.date} ${b.time} ${timezoneOffset}`));

    for (const entry of sorted) {
      const eventDate = new Date(`${entry.date} ${entry.time} ${timezoneOffset}`);
      if (eventDate > now) {
        setNextEvent({ ...entry, eventDate });
        setTimeLeft(Math.floor((eventDate - now) / 1000));
        break;
      }
    }
  }, [schedule]);

  useEffect(() => {
    if (!timeLeft) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  return { nextEvent, timeLeft };
}

function formatFullTime(sec) {
  const days = Math.floor(sec / (60 * 60 * 24));
  const hours = Math.floor((sec % (60 * 60 * 24)) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  return `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`;
}

function formatDday(sec) {
  const days = Math.ceil(sec / (60 * 60 * 24));
  return `D-${days}`;
}

export default function InvestSchedule() {
  const cpi = useNextEvent(cpiSchedule);
  const fomc = useNextEvent(fomcSchedule);

  return (
    <Row gutter={16} style={{ margin: "0.5rem" }}>
      <Col span={12}>
        <Card style={{ background: "#f6f9fc" }}>
          <Typography style={{ fontSize: '1rem', fontWeight: 'bold' }}>미국 소비자물가지수 발표</Typography>
          {cpi.nextEvent ? (
            <Typography style={{ fontSize: '0.8rem'}}>
              📅 <strong>{cpi.nextEvent.date}</strong> {cpi.nextEvent.time}(미국기준, UTC-5) 발표 예정<br />
              ⌛ <strong>{formatFullTime(cpi.timeLeft || 0)}</strong> 남았습니다.
            </Typography>
          ) : (
            <Typography>예정된 CPI 발표가 없습니다.</Typography>
          )}
        </Card>
      </Col>
      <Col span={12}> 
        <Card style={{ background: "#f6f9fc" }}>
          <Typography style={{ fontSize: '1rem', fontWeight: 'bold' }}>FOMC 회의일정</Typography>
          {fomc.nextEvent ? (
            <Typography style={{ fontSize: '0.8rem'}}>
              📅 <strong>{fomc.nextEvent.date}</strong>(미국기준, UTC-5) 발표 예정<br />
              ⌛ <strong>{formatDday(fomc.timeLeft || 0)}</strong> 남았습니다.
            </Typography>
          ) : (
            <Typography>예정된 FOMC 일정이 없습니다.</Typography>
          )}
        </Card>
      </Col>
    </Row>
  );
}
