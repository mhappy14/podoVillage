import {React, useState} from 'react'
import { Box, Button  } from '@mui/material'
import MyTextField from './forms/MyTextField'
import MyPassField from './forms/MyPassField'
import MyButton from './forms/Mybutton'
import {Link} from 'react-router-dom'
import {useForm} from 'react-hook-form'
import AxiosInstance from './AxiosInstance'
import { useNavigate } from 'react-router-dom'
import MyMessage from './Message'

const Login = () =>{
	const navigate = useNavigate()
	const {handleSubmit, control} = useForm()
  const [ShowMessage, setShowMessage] = useState(false)

	const submission = (data) => {
		AxiosInstance.post(`login/`,{
			email: data.email, 
			password: data.password,
		})
		.then((response) => {
			console.log(response)
			localStorage.setItem('Token', response.data.token)
			navigate(`/home`)
		})
		.catch((error) => {
			setShowMessage(true)
			console.error('Error during login', error)
		})
	}

	return(
		<div className={"myBackground"}>
      {ShowMessage ? <MyMessage text={"Login fail, try again or reset pw"} color={'#69C9AB'} marginTop={'200px'}/> : null}
			<form onSubmit={handleSubmit(submission)}>
				<Box className={"whiteBox"}>

					<Box className={"itemBox"}>
						<Box className={"title"}>login please</Box>
					</Box>

					<Box className={"itemBox"}>
						<MyTextField
							label={"Email"}
							name ={"email"}
							control={control}
						/>
					</Box>

					<Box className={"itemBox"}>
						<MyPassField
							label={"Password"}
							name ={"password"}
							control={control}
						/>
					</Box>

					<Box className={"itemBox"}>
						<MyButton
							label={"Login"}
							type={"submit"}
						/>
					</Box>

					<Box className={"itemBox"} sx={{flexDirection:'flex', gap: '1rem'}}>
						<Button  component={Link} to="/register" sx={{
							width: '100%',
							backgroundColor: 'rgb(66, 8, 160)',
							color: 'white',
							'&:hover': { backgroundColor: 'rgb(50, 5, 130)' }}}>Register</Button >
						<Button  component={Link} to="/request/password_reset" sx={{
							width: '100%',
							backgroundColor: 'rgb(66, 8, 160)',
							color: 'white',
							'&:hover': { backgroundColor: 'rgb(50, 5, 130)' }}}>Password Reset</Button >
					</Box>

				</Box>
			</form>
		</div>
	)
}

export default Login