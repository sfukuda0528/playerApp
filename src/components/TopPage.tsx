import { useNavigate } from 'react-router-dom'

export default function TopPage() {
  const navigate = useNavigate()
  return (
    <div>
      <h1>CampCanvas</h1>
      <button onClick={() => navigate('/create')}>セッション開始</button>
      <button onClick={() => navigate('/join')}>セッションに参加</button>
    </div>
  )
}
