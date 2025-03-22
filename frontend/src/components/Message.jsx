import { Box } from "@mui/material"

const MyMessage = ({text, color}) =>{
  return(
    <Box 
      sx={{
        backgroundColor: color, 
        color:'#FFFFFF', 
        width: '50%', 
        height: '40px',
        position:'absolute', 
        top:'20px', 
        display:'flex', 
        justifyContent:'center', 
        alignItems:'center',
        marginTop:'80px'
      }}>
      {text}
    </Box>
  )
}

export default MyMessage