import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Link } from "react-router-dom";
import moment from 'moment'
import './LatestNewsSingleContainer.css';
import './LatestNewsSingleContainerMediaQuerries.css';
import { asyncChangeView } from '../../redux/actions/viewActions';
import { asyncChangeCurrentPartie, asyncGetPartieNews } from '../../redux/actions/partiesActions';
import { asyncLoadArticle } from '../../redux/actions/articleActions';
import { checkDarkMode, checkDarkModeLinks } from '../../utils/CheckDarkMode.js';
import MediaQuery from 'react-responsive';

class LatestNewsSingleContainer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      size: true
    }
  }

  onLoadImage = ({target: img}) => {
    if (img.naturalWidth <= 467){
      this.setState({
        size: false
      });
    }
  }

  selectPartie = (i) => {
    this.props.changeView("PARTIES");
    this.props.changeCurrentPartie(this.props.parties[i]);
    this.props.getPartieNews(this.props.parties[i].id)
  }

  elemFuncs = (currentElem) => {
    for(var i = 0; i < this.props.parties.length; i++) {
      if (currentElem === this.props.parties[i].party_name) {
        this.selectPartie(i);
        window.scrollTo(0, 0)
        return;
      }
    }
  }

  getTags = (tags) => {
    let divided_tags = tags.split(",")

    return divided_tags.map((item, index) => (
      <Link to={"/partido/" + item.toLowerCase()} key={item + index} className={'latestNewsNavLink' + checkDarkMode(this.props.darkMode, true)}><div className="tags" onClick={() => this.elemFuncs(item)}>{item}<div className="separator">|</div></div></Link>
    ));
  }

  render() {
    const article = this.props.article ? this.props.article : this.props.currentArticle;

    if(article) { 
      const title = <h1 className="lastestNewsSingleContainerTitle selectForbiden" dangerouslySetInnerHTML={{__html: article.title}}></h1>;
      const time = <div className="selectForbiden">{moment(article.published_time).format('DD-MM-YYYY | HH:mm')}</div>
      const news_url = <a href={article.news_url} className={"latestNewsDiscussionSource" + checkDarkModeLinks(this.props.darkMode)} rel="noopener noreferrer">{article.source}</a>;
      const tags = this.getTags(article.tags);
      const image = article.image_url ? <img onLoad={this.onLoadImage} className={this.state.size ? "newsImageContainer" : "newsImageContainer"} src={article.image_url}  alt="politicando noticia imagem" title={article.title} /> : "";
      const content = article.content.substring(0, 210) + "...";
      const comments = <Link to={`/article/${article.id}`} className={'latestNewsNavLink' + checkDarkMode(this.props.darkMode, true)}><p>{article.comments_count === 0 ? "Comentários" : article.comments_count === 1 ? "1 Comentário" : article.comments_count + " Comentários"}</p></Link>;
    
    return (
        <MediaQuery maxWidth={1280}>
          {(matches) => {
            if (matches) {  
              return (
                <div className={'latestNewsSingleContainer' + checkDarkMode(this.props.darkMode, true)}>
                  <div onClick={() => this.props.getArticle(article.id)}>
                    <Link to={`/article/${article.id}`} className={'newsTitle' + checkDarkMode(this.props.darkMode, true)}>{title}</Link>
                  </div>
                  <div className="latestNewsContentContainer">
                    <a href={article.news_url} rel="noopener noreferrer" className="newsImageContainer">
                      {image}
                      <div className={"urlOverImage" + checkDarkMode(this.props.darkMode)}><i className="material-icons commentIconsLink">link</i></div>
                    </a>
                    <div className="contentFade" onClick={() => this.props.getArticle(article.id)}>
                      <Link to={`/article/${article.id}`} className={"newsComment" + checkDarkMode(this.props.darkMode, true)}>
                        <div className="selectForbiden">
                          {content}
                          <div className={this.props.darkMode ? "fadeoutMobile fadeoutDarkMode" : "fadeoutMobile"}></div>
                        </div>
                      </Link>
                    </div>
                  </div>
                  <div className="latestNewsDiscussionContainer">
                    <div className="newsTimeStamp">
                      <div className="newsTimeUrl">
                        {time}<div className="separator">|</div>{news_url}<div className="separator">|</div>
                      </div>
                      <div className="latestNewsDiscussionContainerLinkContainer" onClick={() => this.props.getArticle(article.id)}>
                        <i className="material-icons commentIcons">comment</i>
                        <div className="commentContainer">{comments}</div>
                      </div>                    
                    </div>
                    <div className="tagList">
                      {tags}
                    </div>
                  </div>
                </div>
              );
            } else {
              return (
                <div className={'latestNewsSingleContainer' + checkDarkMode(this.props.darkMode, true)}>
                  <div onClick={() => this.props.getArticle(article.id)}>
                    <Link to={`/article/${article.id}`} className={'newsTitle' + checkDarkMode(this.props.darkMode, true)}>{title}</Link>
                  </div>
                  <div className="latestNewsContentContainer">
                    <a href={article.news_url} rel="noopener noreferrer" className="newsImageContainer">
                      {image}
                      <div className={"urlOverImage" + checkDarkMode(this.props.darkMode)}><i className="material-icons commentIconsLink">link</i></div>
                    </a>
                    <div>
                      <div className="contentFade" onClick={() => this.props.getArticle(article.id)}>
                        <Link to={`/article/${article.id}`} className={"newsComment" + checkDarkMode(this.props.darkMode, true)}>
                          <div className="selectForbiden">
                            {content}
                          </div>
                          <div className={this.props.darkMode ? "fadeout fadeoutDarkMode" : "fadeout"}></div>
                        </Link>
                      </div>
                      <div className="latestNewsDiscussionContainer">
                        <div className="newsTimeStamp">
                          <div className="newsTimeUrl">
                          {time}<div className="separator">|</div>{news_url}<div className="separator">|</div>
                          </div>
                          <div className="tagList">
                            {tags}
                          </div>
                        </div>
                        <div className="latestNewsDiscussionContainerLinkContainer" onClick={() => this.props.getArticle(article.id)}>
                          <i className="material-icons commentIcons">comment</i>
                          <div className="commentContainer">{comments}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }
          }}
        </MediaQuery>
      );
    } else {
      return null
    } 
  }
}

function mapStateToProps(state) {
  return {
    parties: state.parties.partieList,
    darkMode: state.view.darkMode,
    currentArticle: state.articles.currentArticle
  };
}

function mapDispatchToProps(dispatch) {
  return {
    changeView: (view) => {
      dispatch(asyncChangeView(view))
    },
    changeCurrentPartie: (partie) => {
      dispatch(asyncChangeCurrentPartie(partie))
    },
    getPartieNews: (partie_id) => {
      dispatch(asyncGetPartieNews(partie_id))
    },
    getArticle: (article_id) => {
      dispatch(asyncLoadArticle(article_id))
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LatestNewsSingleContainer);
