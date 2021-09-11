import React, { useState, useEffect, ReactElement } from 'react'
import { useHistory, useParams } from 'react-router-dom'

import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import CircularProgress from '@material-ui/core/CircularProgress'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'
import Radio from '@material-ui/core/Radio'
import Typography from '@material-ui/core/Typography'

import { Subject, SubjectGradeStats, SubjectReview } from 'types/Subject'

import api from 'API'
import BreadCrumb from 'components/Breadcrumb'
import CollapsibleText from 'components/CollapsibleText'
import MessagePanel from 'components/MessagePanel'
import Navbar from 'components/Navbar'
import RequirementsGraph from 'components/RequirementsGraph'
import { buildURI as buildLoginPageURI } from 'pages/LoginPage'
import { buildURI as buildSubjectPageURI } from 'pages/SubjectPage'
import { buildURI as buildSubjectsPageURI } from 'pages/SubjectsPage'
import { copyObj, getCourseAlias } from 'utils'

import CreditsIndicator from './CreditsIndicator'
import GradeDistributionChart from './GradeDistributionChart'

export interface URLParameter {
	course: string
	specialization: string
	code: string
}

function getBreadcrumbLinks (course: string, specialization: string, code: string) {
	return [
		{
			url: buildSubjectsPageURI(),
			text: 'Disciplinas'
		},
		{
			url: buildSubjectPageURI(course, specialization, code),
			text: code
		}

	]
}

interface SubjectEvaluationRadioProps {
	chosen: 'S' | 'N' | null
	clickCallback: Function
}

const SubjectEvaluationRadio: React.FC<SubjectEvaluationRadioProps> = ({ chosen, clickCallback }) => {
	const options = ['S', 'N']

	return <Grid container justify='space-between' alignItems='center'>
		<p> Vale a pena? </p>
		{options.map(c => <div key={c}>
			<Radio

				checked={c === chosen}
				onChange={() => clickCallback(c)}
				value={c}
			/>
			<span>{c}</span>
		</div>
		)}

	</Grid>
}

function getSubjectRequirementsList (sub: Subject) {
	if (!sub.requirements.length || !sub.requirements[0].length) throw new Error("Subject requirement list is empty when it shouldn't be")
	return sub.requirements[0].map(req => req.code).join(', ')
}

function getRecommendationRate (recommend: number, total: number) {
	if (total === 0) return 0
	return (100 * recommend / total).toFixed(0)
}

export function buildURI (courseCode: string, courseSpecialization: string, subjectCode: string): string {
	return `/disciplinas/${courseCode}/${courseSpecialization}/${subjectCode}`
}

const SubjectPage = () => {
	const { course, specialization, code } = useParams<URLParameter>()

	const history = useHistory()

	const [subject, setSubject] = useState<Subject | null>(null)
	const [isLoading, setIsLoading] = useState<boolean>(true)
	const [errorMessage, setErrorMessage] = useState<string>('')
	const [evaluateSubject, setEvaluateSubject] = useState<boolean>(false) // if the user can review (or re-review) the subject
	const [subjectReview, setSubjectReview] = useState<SubjectReview | null>(null)
	const [canSeeChart, setCanSeeChart] = useState<boolean>(false)
	const [gradeStats, setGradeStats] = useState<SubjectGradeStats | null>(null)
	const [yourGrade, setYourGrade] = useState<number | null>(null)
	// query for the subject with code 'code'
	useEffect(() => {
		setSubject(null)
		setIsLoading(true)
		setErrorMessage('')
		setEvaluateSubject(false)
		setCanSeeChart(false)
		setSubjectReview(null)
		setYourGrade(null)

		api.getSubjectWithCourseAndCode(course, specialization, code).then((data) => {
			setSubject(data)
			setIsLoading(false)
		}).catch((err: number) => {
			setIsLoading(false)
			if (err === 404) {
				setErrorMessage('Não foi possível encontrar essa disciplina')
			} else if (err !== 200) {
				setErrorMessage(`Algo de errado aconteceu e essa página retornou com status ${err}`)
			} else {
				setErrorMessage('')
			}
		})

		api.getSubjectReview(course, specialization, code).then((rev) => {
			setSubjectReview(rev)
			setEvaluateSubject(true)
		}).catch((err: number) => {
			if (err === 404) {
				setEvaluateSubject(true)
			} else { // either user is not logged in or user was not enrolled in subject
				setEvaluateSubject(false)
			}
		})

		api.getSubjectGrades(course, specialization, code).then((gradeStats) => {
			setCanSeeChart(true)
			setGradeStats(gradeStats)
		}).catch(() => {
			setCanSeeChart(false)
			setGradeStats(null)
		})

		api.getGrade(course, specialization, code).then((grade) => {
			setYourGrade(grade.grade)
		}).catch(() => {})
	}, [course, specialization, code])

	const handleReviewSubject = (c: 'S' | 'N') => {
		const review: SubjectReview = {
			categories: {
				worth_it: c === 'S'
			}
		}

		// remove subjectReview, se ja existir
		const newSubject = subject
		if (subjectReview !== null) {
			newSubject.stats.total--
			newSubject.stats.worth_it -= subjectReview.categories.worth_it ? 1 : 0
		}

		newSubject.stats.total++
		newSubject.stats.worth_it += c === 'S' ? 1 : 0
		setSubject(newSubject)
		setSubjectReview(review)
		api.makeSubjectReview(course, specialization, code, review)
	}

	// Chart Content
	let chartContent = <></>
	if (canSeeChart && gradeStats) {
		if (gradeStats.grades && Object.keys(gradeStats.grades).length > 0) {
			chartContent = <GradeDistributionChart grades={copyObj(gradeStats.grades)} averageGrade={gradeStats.average} yourGrade={yourGrade}/>
		} else {
			chartContent = <MessagePanel height={200} message="Não há dados suficientes para mostrar esse recurso"/>
		}
	} else {
		const redirectLogin = () => {
			history.push(buildLoginPageURI(), { from: history.location })
		}
		chartContent = <MessagePanel height={200} action={redirectLogin} actionTitle="Entrar" message="Você precisa estar logado para ter acesso a esse recurso"/>
	}

	const content = subject ? <>
		<Typography variant='h4'>{`${subject.code} - ${subject.name}`}</Typography>

		<br></br>

		<CollapsibleText text={subject.description} maxCharacters={200} Child={Typography as ReactElement} childrenProps={{}}/>

		<br></br>
		<br></br>

		<Grid container spacing={5}>
			<Grid container item xs={12} sm={3} direction="column">
				<Grid container spacing={4}>
					<Grid item xs={12}>
						<Card elevation={3} className='prompt'>
							<div className='graybg'>
								<CardContent>

									<Grid container spacing={0}>
										<Grid item xs={6}>
											<CreditsIndicator value={subject.class} title={'CA'}/>
										</Grid>
										<Grid item xs={6}>
											<CreditsIndicator value={subject.assign} title={'CT'}/>
										</Grid>
									</Grid>
								</CardContent>
							</div>
							<CardContent>
								Tipo: {subject.optional ? 'Optativa' : 'Obrigatória'}<br/>
								Curso: {getCourseAlias(course, specialization)}<br/>
								Semestre: {subject.semester + '°'} <br/>
								Requisitos: {subject.requirements.length ? getSubjectRequirementsList(subject) : 'Nenhum'}<br/>
								Carga horária: {subject.hours}<br/>
							</CardContent>
						</Card>
					</Grid>
					<Grid item xs={12}>
						<Card elevation={3} className='prompt'>
							<CardContent>
								<p className="roboto-condensed"> {evaluateSubject ? 'AVALIE A DISCIPLINA' : 'SOBRE A DISCIPLINA'} </p>

								{evaluateSubject
									? <SubjectEvaluationRadio chosen={subjectReview ? (subjectReview.categories.worth_it ? 'S' : 'N') : null} clickCallback={handleReviewSubject}/>
									: <></>}
								<p> {getRecommendationRate(subject.stats.worth_it, subject.stats.total)}% dos alunos dizem que essa disciplina vale a pena! </p>
								<p> Total de reviews: {subject.stats.total}</p>

							</CardContent>
						</Card>
					</Grid>
				</Grid>
			</Grid>

			<Grid container item xs={12} sm={9} direction='column'>

				<Grid container item spacing={4}>
					<Grid item xs={12}>
						<Card elevation={3} className="overflow">
							<CardContent>
								<Typography variant="h6"> Distribuição de Notas </Typography>
								{chartContent}

								{canSeeChart && gradeStats && gradeStats.grades && Object.keys(gradeStats.grades).length > 0
									? <>
										<Typography variant='body1'> Taxa de Aprovação: {(gradeStats.approval * 100).toFixed(1)}% </Typography>
										<Typography variant='body1'> Média: {gradeStats.average.toFixed(1)} </Typography>
										{yourGrade ? <Typography variant='body1'> Sua nota: {yourGrade.toFixed(1)} </Typography> : null}
									</> : null
								}
							</CardContent>
						</Card>
					</Grid>

					<Grid item xs={12}>
						<Card elevation={3}>
							<CardContent>
								<Typography variant="h6"> Requisitos e Trancamentos </Typography>
								<RequirementsGraph name={subject?.name} course={course} specialization={specialization} code={code} />
							</CardContent>
						</Card>
					</Grid>
				</Grid>
			</Grid>
		</Grid>
	</> : <></>

	const object =
		isLoading ? <Grid container justify='center'><Grid item><CircularProgress/></Grid></Grid>
			: (
				errorMessage ? <Typography variant='h4'>{errorMessage}</Typography>
					: content
			)
	return <div className='main'>
		<main>
			<Navbar/>
			<div style={{ height: '64px' }}></div>
			<Container>
				<Grid container alignItems='center' style={{ height: '50px' }}>
					<BreadCrumb links={getBreadcrumbLinks(course, specialization, code)}/>
				</Grid>

				{object}
			</Container>
		</main>
	</div>
}

export default SubjectPage
