export const apiUrls = { }
const baseUrl = false ? "http://localhost:4000/api" : "https://politicando-backend.herokuapp.com/api" 
const apiVersion = "/v1"

apiUrls.getParties =  `${baseUrl}${apiVersion}/partidos`
apiUrls.getNews = `${baseUrl}${apiVersion}/articles`
apiUrls.getPartieNews = `${baseUrl}${apiVersion}/partidos/{partie_id}/partie_articles`
apiUrls.getNextTenNews = `${baseUrl}${apiVersion}/articles/{article_id}/get_ten`
apiUrls.getNextTenPartieNews = `${baseUrl}${apiVersion}/partidos/{party_id}/get_ten/{article_id}`
apiUrls.getArticle = `${baseUrl}${apiVersion}/articles/{article_id}`
apiUrls.getArticleComments = `${baseUrl}${apiVersion}/articles/{article_id}/article_comments`
apiUrls.createComment = `${baseUrl}${apiVersion}/comments`
