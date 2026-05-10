import YouTube from 'react-youtube'

interface Props {
  videoId: string
}

export default function AmbientPlayer({ videoId }: Props) {
  return (
    <YouTube
      videoId={videoId}
      opts={{
        width: '200',
        height: '113',
        playerVars: {
          autoplay: 1,
          loop: 1,
          playlist: videoId,
          controls: 0,
        },
      }}
    />
  )
}
