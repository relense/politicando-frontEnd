import React, { Component } from 'react';
import { connect } from 'react-redux';
import './Header.css';
import { asyncChangeView, asyncChangePartyView } from '../../actions/viewActions';
import { asyncChangeCurrentPartie, asyncGetPartieNews } from '../../actions/partiesActions';

const HOME = 'HOME';
const ABOUT = 'ABOUT';
const PARTIES = 'PARTIES';

class Header extends Component {
  selectPartie = (i) => {
    this.props.changeView("PARTIES");
    this.props.changeCurrentPartie(this.props.parties[i]);
    this.props.getPartieNews(this.props.parties[i].id)
  }

  elemFuncs = (currentElem, i = -1) => {
    if(i !== -1) {
      this.selectPartie(i);
      window.scrollTo(0, 0)
      this.props.setPartyView("NOTICIAS");    
      return;
    } else {
      this.props.changeView(currentElem);
      if(currentElem !== "PARTIES")
        window.scrollTo(0, 0)
    }
  }

  renderMainRow = () => {
    let data = [];

    if(this.props.current === HOME)
      data.push(<div key={HOME} className="navElems selectedElem" onClick={() => this.elemFuncs(HOME)}>ÚLTIMAS NOTÍCIAS</div>);
    else
      data.push(<div key={HOME} className="navElems" onClick={() => this.elemFuncs(HOME)}>ÚLTIMAS NOTÍCIAS</div>);

    if(this.props.current  === PARTIES)
      data.push(<div key={PARTIES} className="navElems selectedElem" onClick={() => this.elemFuncs(PARTIES)}>PARTIDOS</div>)
    else
      data.push(<div key={PARTIES} className="navElems" onClick={() => this.elemFuncs(PARTIES)}>PARTIDOS</div>)

    if(this.props.current  === ABOUT)
      data.push(<div key={ABOUT} className="navElems selectedElem" onClick={() => this.elemFuncs(ABOUT)}>SOBRE</div>)
    else
      data.push(<div key={ABOUT} className="navElems" onClick={() => this.elemFuncs(ABOUT)}>SOBRE</div>)

    return data;
  }

  renderPartieRow = () => {
    let data = [];

    if (this.props.parties.length !== 0) {
      for(let i = 0; i < this.props.parties.length; i++) {
        if(this.props.currentPartie.party_name === this.props.parties[i].party_name) {
          data.push(
              <div key={i} className="navElems selectedElem" onClick={() => this.elemFuncs(this.props.parties[i], i)}>
                  { this.props.parties[i].party_name }
              </div>
          );
        } else {
          data.push(
              <div key={i} className="navElems" onClick={() => this.elemFuncs(this.props.parties[i], i)}>
                  { this.props.parties[i].party_name }
              </div>
          );
        }
      }
    }
    return data;
  }

  render() {
    return (
      <div className={this.props.scroll ? "header sticky" : "header"}>
        <div className="title">
          <a href="http://localhost:3000" className="siteTitleLink"><h1>POLITICANDO</h1></a>
        </div>
        <div className="nav">
          { this.renderMainRow() }
        </div>
        {this.props.current === PARTIES ?
          <div className="nav">{ this.renderPartieRow() }</div> : <div className="nav"><div className="navElems"></div></div>
        }
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    current: state.view.currentView,
    parties: state.parties.partieList,
    currentPartie: state.parties.currentPartie,
    partyView: state.view.partyView
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
    setPartyView: (view) => {
      dispatch(asyncChangePartyView(view))
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Header);
