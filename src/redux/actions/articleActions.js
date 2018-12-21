import * as types from './actionTypes';
import { apiUrls } from '../../api/apiUrls';
import { get, post } from '../../api/Api';

export function reveiveArticle(article) {
    return {
        type: types.GET_ARTICLE,
        currentArticle: article
    }
}

export function receiveArticleComments(comments) {
    return {
        type: types.GET_ARTICLE_COMMENTS,
        comments: comments
    }
}

export function loading(loading) {
    return {
        type: types.LOADING,
        loading: loading
    }
}

export function setComment(comment, characters = 0){
    return {
        type: types.SET_COMMENT,
        comment: comment,
        characters: characters
    }
}

export function asyncSetComments(comment, articleId, child = false) {
    return async function(dispatch){
            
        try {
            dispatch(loading(true))
            if(child) {
                dispatch(asyncPostComment(articleId, comment));
            } else {
                dispatch(asyncPostComment(articleId, comment));
            }
            let newComment = comment.comment = "";
            dispatch(asyncLoadArticle(articleId));
            dispatch(setComment(newComment));

        } catch (error) {
            console.log(error);
        } finally {
            dispatch(loading(false))
        }
    }
}

export const asyncLoadArticle = (article_id) => {
    return async function(dispatch){
        try {
            const response = await get(apiUrls.getArticle.replace('{article_id}', article_id))
            dispatch(reveiveArticle(response))
        } catch (error) {
            console.log(error);
        }
    }
}

export const asyncLoadArticleComments = (article_id) => {
    return async function(dispatch){
        try {
            dispatch(loading(true))
            const response = await get(apiUrls.getArticleComments.replace('{article_id}', article_id))
            dispatch(receiveArticleComments(response))
            return response;
        } catch (error) {
            console.log(error);
        } finally {
            dispatch(loading(false));
        }
    }
}

export const asyncPostComment = (articleId, comment) => {
    return async function(dispatch) {
        try {
            let user = comment.username ? comment.username : null;
            let content = comment.comment;
            let commentType = comment.commentType;
            let commentId = comment.id ? comment.id : null;
            
            const payload = {
                comments: {
                    username: user,
                    comment: content,
                    commentType: commentType,
                    article_id: articleId,
                    comments_id: commentId
                }
            }

            return await post(apiUrls.createComment, payload).then(() => {
                dispatch(asyncLoadArticleComments(articleId));
            });
        } catch (error) {
            console.log(error);
        }
    }
}