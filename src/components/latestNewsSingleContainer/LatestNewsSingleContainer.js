import React, { Component } from 'react';
import { connect } from 'react-redux';
import moment from 'moment'
import './LatestNewsSingleContainer.css';
import { asyncChangeView } from '../../actions/viewActions';
import { asyncChangeCurrentPartie, asyncGetPartieNews } from '../../actions/partiesActions';

class LatestNewsSingleContainer extends Component {

  state = {
    size: true
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
      <div className="tags" key={item + index} onClick={() => this.elemFuncs(item)}>{item} |</div>
    ));
  }

  render() {
    const tags = this.getTags(this.props.article.tags);
    const news_url = <a href={"https://" +this.props.article.source} className="latestNewsDiscussionSource" target="_blank" rel="noopener noreferrer">{this.props.article.source}</a>
    const title = <a href={this.props.article.news_url} className="newsTitle" target="_blank" rel="noopener noreferrer"><h1 className="lastestNewsSingleContainerTitle selectForbiden">{this.props.article.title}</h1></a>

    return (
      <div className="latestNewsSingleContainer">
        {title}
        <div className="latestNewsContentContainer">
          {this.props.article.image_url &&
            <img onLoad={this.onLoadImage} src={this.props.article.image_url} className={ this.state.size ? "newsImage" : "newsImageSmaller"} alt="Article" title={this.props.article.title} />
          }
          <div className="selectForbiden">
            {this.props.article.content}
            <div className="fadeout"></div>
          </div>
        </div>
        <div className="latestNewsDiscussionContainer">
          {moment(this.props.article.published_time).format('DD-MM-YYYY | HH:mm')} | {news_url} | {tags}
          <div className="latestNewsDiscussionContainerLinkContainer">
            <div style={{paddingRight: '10px', cursor: 'pointer'}}>382 Comentários </div>
            <a href={this.props.article.news_url} className="latestNewsDiscussionContainerLink" target="_blank" rel="noopener noreferrer">
              Visitar notícia
            </a>
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    parties: state.parties.partieList,
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
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LatestNewsSingleContainer);
