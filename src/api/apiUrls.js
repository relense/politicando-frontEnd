export const apiUrls = { }

// const isMobile = window.innerWidth <= 500

const baseUrl = false ? "http://192.168.1.11:4000/api" : "https://git.heroku.com/politicando-backend.git/api" 
const apiVersion = "/v1"

apiUrls.getParties =  `${baseUrl}${apiVersion}/partidos`
apiUrls.getNews = `${baseUrl}${apiVersion}/articles`
apiUrls.getPartieNews = `${baseUrl}${apiVersion}/partidos/{partie_id}/partie_articles`
apiUrls.getNextTenNews = `${baseUrl}${apiVersion}/articles/{article_id}/get_ten`
apiUrls.getNextTenPartieNews = `${baseUrl}${apiVersion}/partidos/{party_id}/get_ten/{article_id}`
apiUrls.getArticle = `${baseUrl}${apiVersion}/articles/{article_id}`
